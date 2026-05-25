import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { createCorsHeaders } from '../_shared/cors.ts'
import { logAppAudit } from '../_shared/app-audit.ts'

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'))

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

    const body = await req.json().catch(() => ({}))
    const title = String(body?.title ?? '').trim()
    const description = String(body?.description ?? '').trim()
    const recipientWalletAddress = String(body?.recipient_wallet_address ?? '').trim()
    const releaseDate = String(body?.release_date ?? '').trim()
    const goalAmountRaw = body?.goal_amount
    const imageUrl = String(body?.image_url ?? '').trim()
    const submissionNotes = String(body?.submission_notes ?? '').trim()
    const contactEmail = String(body?.contact_email ?? user.email ?? '').trim()

    // Accepted assets whitelist — donors using our flow can only send these.
    // Default to XRP-only when omitted. XRP is always required.
    const ALLOWED_ASSETS = ['XRP', 'RLUSD'] as const
    const rawAssets = Array.isArray(body?.accepted_assets) ? body.accepted_assets : null
    const acceptedAssets = rawAssets
      ? Array.from(new Set(rawAssets.map((a: unknown) => String(a).toUpperCase().trim())))
      : ['XRP']
    if (!acceptedAssets.includes('XRP')) acceptedAssets.unshift('XRP')
    if (acceptedAssets.length === 0 || !acceptedAssets.every((a) => (ALLOWED_ASSETS as readonly string[]).includes(a))) {
      return new Response(JSON.stringify({ error: `accepted_assets must be a non-empty subset of ${ALLOWED_ASSETS.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (title.length < 10 || title.length > 100) {
      return new Response(JSON.stringify({ error: 'Title must be between 10 and 100 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (description.length < 50 || description.length > 5000) {
      return new Response(JSON.stringify({ error: 'Description must be between 50 and 5000 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(recipientWalletAddress)) {
      return new Response(JSON.stringify({ error: 'Must be a valid XRPL r-address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsedReleaseDate = new Date(releaseDate)
    if (Number.isNaN(parsedReleaseDate.getTime())) {
      return new Response(JSON.stringify({ error: 'Release date is invalid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const minReleaseAt = Date.now() + (30 * 24 * 60 * 60 * 1000)
    if (parsedReleaseDate.getTime() < minReleaseAt) {
      return new Response(JSON.stringify({ error: 'Release date must be at least 30 days in the future' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (submissionNotes.length < 20 || submissionNotes.length > 2000) {
      return new Response(JSON.stringify({ error: 'Submission notes must be between 20 and 2000 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return new Response(JSON.stringify({ error: 'Contact email is invalid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const goalAmount = goalAmountRaw === '' || goalAmountRaw == null ? null : Number(goalAmountRaw)
    if (goalAmountRaw !== '' && goalAmountRaw != null && (!Number.isFinite(goalAmount) || (goalAmount ?? 0) < 0)) {
      return new Response(JSON.stringify({ error: 'Goal amount is invalid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const svc = createClient(supabaseUrl, supabaseServiceKey)
    const { data: campaign, error } = await svc
      .from('campaigns')
      .insert({
        title,
        slug: `${slugify(title)}-${Date.now().toString(36)}`,
        description,
        recipient_wallet_address: recipientWalletAddress,
        goal_amount: goalAmount,
        campaign_type: 'escrow',
        release_date: parsedReleaseDate.toISOString(),
        image_url: imageUrl || null,
        submitted_by_user_id: user.id,
        submitted_by_email: contactEmail || null,
        submission_notes: submissionNotes,
        status: 'under_review',
      })
      .select('*')
      .single()

    if (error) throw error

    await logAppAudit(svc, {
      area: 'causes',
      action: 'submitted',
      entityType: 'campaign',
      entityId: campaign.id,
      actorId: user.id,
      afterState: campaign,
      metadata: {
        origin: 'campaign-submit',
        release_date: campaign.release_date,
      },
    })

    return new Response(JSON.stringify({ success: true, campaign }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in campaign-submit:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
