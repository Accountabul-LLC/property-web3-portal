/**
 * campaign-release  (admin only)
 *
 * Triggers EscrowFinish for all escrowed donations on a campaign whose
 * release_date has passed. Funds go directly from escrow to the release
 * signer wallet, and the helper marks the campaign completed when all
 * escrows are released.
 *
 * Uses the network stored on the original Xaman payload so the release path
 * matches the donation path. If a signer seed is configured, the function
 * auto-submits EscrowFinish. Otherwise it returns transaction JSON for
 * manual signing.
 *
 * Body: { campaign_id }
 * Returns: { released_count, results[] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { releaseCampaignEscrows } from '../_shared/campaign-release.ts'
import { logAppAudit } from '../_shared/app-audit.ts'

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const fallbackOrigin = Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.com'
  const allowed = /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com)$/i.test(origin)
    || origin === fallbackOrigin
    || origin === 'https://accountabul.com'

  return {
    'Access-Control-Allow-Origin': allowed ? origin : fallbackOrigin,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const svc = createClient(supabaseUrl, supabaseServiceKey)

    const { data: isAdmin } = await svc.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: isCompliance } = await svc.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
    if (!isAdmin && !isCompliance) {
      return new Response(JSON.stringify({ error: 'Forbidden: requires admin or compliance_officer role' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { campaign_id } = await req.json()
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'Missing campaign_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: campaign } = await svc
      .from('campaigns')
      .select('id, title, status, campaign_type, release_date, recipient_wallet_address, network')
      .eq('id', campaign_id)
      .maybeSingle()

    if (!campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (campaign.status !== 'active') {
      return new Response(JSON.stringify({ error: `Campaign is not active (status: ${campaign.status})` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (new Date(campaign.release_date) > new Date()) {
      return new Response(JSON.stringify({ error: 'Campaign release date has not passed yet' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Per-network signer seed with single-seed fallback.
    const network = (campaign.network === 'testnet' || campaign.network === 'devnet' || campaign.network === 'mainnet')
      ? campaign.network
      : 'mainnet'
    const networkSeedVar = `CAMPAIGN_RELEASE_SIGNER_SEED_${network.toUpperCase()}`
    const networkAlgVar = `CAMPAIGN_RELEASE_SIGNER_ALGORITHM_${network.toUpperCase()}`
    const signerSeed = Deno.env.get(networkSeedVar) ?? Deno.env.get('CAMPAIGN_RELEASE_SIGNER_SEED')
    const signerAlgorithm = (Deno.env.get(networkAlgVar) ?? Deno.env.get('CAMPAIGN_RELEASE_SIGNER_ALGORITHM') ?? 'secp256k1') as
      | 'ed25519'
      | 'secp256k1'
    const result = await releaseCampaignEscrows({
      svc,
      campaign,
      signerSeed,
      signerAlgorithm,
      allowManualFallback: true,
    })

    await logAppAudit(svc, {
      area: 'causes',
      action: 'release_attempted',
      entityType: 'campaign',
      entityId: campaign.id,
      actorId: user.id,
      afterState: {
        released_count: result.released_count,
        manual_count: result.manual_count,
        error_count: result.error_count,
        total_donations: result.total_donations,
        campaign_completed: result.campaign_completed,
      },
      metadata: {
        origin: 'campaign-release',
        network,
      },
    })


    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in campaign-release:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
