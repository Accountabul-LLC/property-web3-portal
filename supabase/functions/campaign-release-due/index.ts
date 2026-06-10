import { createCorsHeaders } from '../_shared/cors.ts';
/**
 * campaign-release-due
 *
 * Scheduled endpoint for Causes escrow releases.
 * This is intended to be called by Supabase Cron with a dedicated secret.
 *
 * It scans for active campaigns whose release_date has passed and releases
 * all escrowed donations using the signer seed stored in Supabase secrets.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { releaseCampaignEscrows } from '../_shared/campaign-release.ts'
import { logAppAudit } from '../_shared/app-audit.ts'




Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get('CAMPAIGN_RELEASE_CRON_SECRET')
    if (!cronSecret) {
      return new Response(JSON.stringify({ error: 'Cron secret not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const incomingSecret = req.headers.get('x-accountabul-cron-secret')
    if (!incomingSecret || incomingSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const svc = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json().catch(() => ({}))
    const limit = Math.min(Math.max(Number(body?.limit ?? 20) || 20, 1), 50)

    const { data: dueCampaigns, error } = await svc
      .from('campaigns')
      .select('id, title, status, campaign_type, release_date, recipient_wallet_address, network')
      .eq('status', 'active')
      .eq('campaign_type', 'escrow')
      .lte('release_date', new Date().toISOString())
      .order('release_date', { ascending: true })
      .limit(limit)

    if (error) throw error

    const signerSeed = Deno.env.get('CAMPAIGN_RELEASE_SIGNER_SEED')
    const signerAlgorithm = (Deno.env.get('CAMPAIGN_RELEASE_SIGNER_ALGORITHM') ?? 'secp256k1') as
      | 'ed25519'
      | 'secp256k1'
    if (!signerSeed) {
      return new Response(JSON.stringify({
        error: 'Campaign release signer seed not configured',
        due_campaigns: dueCampaigns?.length ?? 0,
      }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: Array<{ campaign_id: string; title: string; result: unknown }> = []
    for (const campaign of dueCampaigns ?? []) {
      const result = await releaseCampaignEscrows({
        svc,
        campaign,
        signerSeed,
        signerAlgorithm,
        allowManualFallback: false,
      })

      await logAppAudit(svc, {
        area: 'causes',
        action: 'cron_release_attempted',
        entityType: 'campaign',
        entityId: campaign.id,
        afterState: {
          released_count: result.released_count,
          manual_count: result.manual_count,
          error_count: result.error_count,
          total_donations: result.total_donations,
          campaign_completed: result.campaign_completed,
        },
        metadata: {
          origin: 'campaign-release-due',
          network: campaign.network ?? 'mainnet',
        },
      })
      results.push({
        campaign_id: campaign.id,
        title: campaign.title,
        result,
      })
    }

    const releasedCampaigns = results.filter(r => {
      const summary = r.result as {
        campaign_completed?: boolean
        released_count?: number
      }
      return summary?.campaign_completed === true || (summary?.released_count ?? 0) > 0
    }).length

    return new Response(JSON.stringify({
      success: true,
      scanned_campaigns: dueCampaigns?.length ?? 0,
      released_campaigns: releasedCampaigns,
      results,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in campaign-release-due:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
