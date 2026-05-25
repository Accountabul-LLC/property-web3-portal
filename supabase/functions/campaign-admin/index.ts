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

function isValidRAddress(address: string) {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)
}

async function requireAdmin(req: Request, corsHeaders: Record<string, string>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }) }
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) {
    return { errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }) }
  }

  const svc = createClient(supabaseUrl, supabaseServiceKey)
  const { data: isAdmin } = await svc.rpc('has_role', { _user_id: user.id, _role: 'admin' })
  const { data: isCompliance } = await svc.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
  if (!isAdmin && !isCompliance) {
    return { errorResponse: new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }) }
  }

  return { user, svc, supabaseUrl }
}

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireAdmin(req, corsHeaders)
    if ('errorResponse' in auth) return auth.errorResponse

    const { user, svc } = auth
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action ?? '').trim()

    if (!action) {
      return new Response(JSON.stringify({ error: 'action is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create') {
      const title = String(body?.title ?? '').trim()
      const description = String(body?.description ?? '').trim()
      const recipientWalletAddress = String(body?.recipient_wallet_address ?? '').trim()
      const releaseDate = body?.release_date == null ? '' : String(body?.release_date ?? '').trim()
      const imageUrl = String(body?.image_url ?? '').trim()
      const videoUrl = String(body?.video_url ?? '').trim()
      const galleryUrls = Array.isArray(body?.gallery_urls) ? body.gallery_urls.filter((url: unknown) => typeof url === 'string') : []
      const status = String(body?.status ?? 'under_review')
      const network = String(body?.network ?? 'testnet')
      const campaignType = String(body?.campaign_type ?? 'escrow')
      const goalAmountRaw = body?.goal_amount
      const submittedByEmail = String(body?.submitted_by_email ?? '').trim()
      const submissionNotes = String(body?.submission_notes ?? '').trim()
      const adminNotes = String(body?.admin_notes ?? '').trim()

      if (title.length < 10 || title.length > 100) throw new Error('Title must be between 10 and 100 characters')
      if (description.length < 50 || description.length > 5000) throw new Error('Description must be between 50 and 5000 characters')
      if (!isValidRAddress(recipientWalletAddress)) throw new Error('Must be a valid XRPL r-address')
      if (!['escrow', 'direct'].includes(campaignType)) throw new Error('campaign_type must be escrow or direct')
      if (campaignType === 'escrow' && (!releaseDate || Number.isNaN(new Date(releaseDate).getTime()))) {
        throw new Error('Release date is invalid')
      }
      if (campaignType === 'direct' && releaseDate && Number.isNaN(new Date(releaseDate).getTime())) {
        throw new Error('Release date is invalid')
      }
      if (!['under_review', 'active'].includes(status)) throw new Error('Status must be under_review or active')
      if (!['testnet', 'mainnet', 'devnet'].includes(network)) throw new Error('Network is invalid')

      const goalAmount = goalAmountRaw === '' || goalAmountRaw == null ? null : Number(goalAmountRaw)
      if (goalAmountRaw !== '' && goalAmountRaw != null && (!Number.isFinite(goalAmount) || (goalAmount ?? 0) < 0)) {
        throw new Error('Goal amount is invalid')
      }

      const { data: campaign, error } = await svc
        .from('campaigns')
        .insert({
          title,
          slug: `${slugify(title)}-${Date.now().toString(36)}`,
          description,
          recipient_wallet_address: recipientWalletAddress,
          release_date: campaignType === 'direct' ? null : new Date(releaseDate).toISOString(),
          campaign_type: campaignType,
          goal_amount: goalAmount,
          image_url: imageUrl || null,
          video_url: videoUrl || null,
          gallery_urls: galleryUrls,
          network,
          currency: 'XRP',
          submitted_by_user_id: null,
          submitted_by_email: submittedByEmail || null,
          submission_notes: submissionNotes || null,
          admin_notes: adminNotes || null,
          status,
          approved_by: status === 'active' ? user.id : null,
          approved_at: status === 'active' ? new Date().toISOString() : null,
        })
        .select('*')
        .single()

      if (error) throw error

      await logAppAudit(svc, {
        area: 'causes',
        action: 'admin_created',
        entityType: 'campaign',
        entityId: campaign.id,
        actorId: user.id,
        afterState: campaign,
        metadata: { origin: 'campaign-admin', status },
      })

      return new Response(JSON.stringify({ success: true, campaign }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update') {
      const campaignId = String(body?.campaign_id ?? '').trim()
      if (!campaignId) throw new Error('campaign_id is required')

      const { data: current, error: fetchError } = await svc
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle()
      if (fetchError) throw fetchError
      if (!current) throw new Error('Campaign not found')

      const updates: Record<string, unknown> = {}
      if (body?.title != null) {
        const title = String(body.title).trim()
        if (title.length < 10 || title.length > 100) throw new Error('Title must be between 10 and 100 characters')
        updates.title = title
      }
      if (body?.description != null) {
        const description = String(body.description).trim()
        if (description.length < 50 || description.length > 5000) throw new Error('Description must be between 50 and 5000 characters')
        updates.description = description
      }
      if (body?.goal_amount !== undefined) {
        const raw = body.goal_amount
        const goalAmount = raw === '' || raw == null ? null : Number(raw)
        if (raw !== '' && raw != null && (!Number.isFinite(goalAmount) || (goalAmount ?? 0) < 0)) {
          throw new Error('Goal amount is invalid')
        }
        updates.goal_amount = goalAmount
      }
      if (body?.image_url !== undefined) {
        const imageUrl = String(body.image_url ?? '').trim()
        updates.image_url = imageUrl || null
      }
      if (body?.video_url !== undefined) {
        const videoUrl = String(body.video_url ?? '').trim()
        updates.video_url = videoUrl || null
      }
      if (body?.gallery_urls !== undefined) {
        if (!Array.isArray(body.gallery_urls)) throw new Error('gallery_urls must be an array')
        updates.gallery_urls = body.gallery_urls.filter((url: unknown) => typeof url === 'string')
      }
      if (body?.campaign_type !== undefined) {
        const campaignType = String(body.campaign_type ?? '').trim()
        if (!['escrow', 'direct'].includes(campaignType)) throw new Error('campaign_type must be escrow or direct')
        if (current.campaign_type === 'direct' && campaignType === 'escrow') {
          throw new Error('Direct campaigns cannot be converted back to escrow once created')
        }
        if (current.donor_count > 0 || Number(current.total_raised) > 0) {
          throw new Error('Campaign type cannot be changed after donations exist')
        }
        updates.campaign_type = campaignType
      }
      if (body?.release_date !== undefined) {
        const releaseDate = body.release_date == null ? '' : String(body.release_date ?? '').trim()
        if (releaseDate) {
          if (Number.isNaN(new Date(releaseDate).getTime())) throw new Error('Release date is invalid')
          updates.release_date = new Date(releaseDate).toISOString()
        } else {
          updates.release_date = null
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No mutable campaign fields were provided')
      }

      const { data: campaign, error } = await svc
        .from('campaigns')
        .update(updates)
        .eq('id', campaignId)
        .select('*')
        .single()
      if (error) throw error

      await logAppAudit(svc, {
        area: 'causes',
        action: 'updated',
        entityType: 'campaign',
        entityId: campaign.id,
        actorId: user.id,
        beforeState: current,
        afterState: campaign,
        metadata: { origin: 'campaign-admin', fields: Object.keys(updates) },
      })

      return new Response(JSON.stringify({ success: true, campaign }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'review') {
      const campaignId = String(body?.campaign_id ?? '').trim()
      const decision = String(body?.decision ?? '').trim()
      const rejectionReason = String(body?.rejection_reason ?? '').trim()
      if (!campaignId) throw new Error('campaign_id is required')
      if (!['approve', 'reject'].includes(decision)) throw new Error('decision must be approve or reject')
      if (decision === 'reject' && !rejectionReason) throw new Error('rejection_reason is required when rejecting')

      const { data: current, error: fetchError } = await svc
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle()
      if (fetchError) throw fetchError
      if (!current) throw new Error('Campaign not found')

      const updates = decision === 'approve'
        ? {
            status: 'active',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            rejection_reason: null,
          }
        : {
            status: 'rejected',
            rejection_reason: rejectionReason,
          }

      const { data: campaign, error } = await svc
        .from('campaigns')
        .update(updates)
        .eq('id', campaignId)
        .select('*')
        .single()
      if (error) throw error

      await logAppAudit(svc, {
        area: 'causes',
        action: decision === 'approve' ? 'approved' : 'rejected',
        entityType: 'campaign',
        entityId: campaign.id,
        actorId: user.id,
        beforeState: current,
        afterState: campaign,
        metadata: decision === 'approve'
          ? { origin: 'campaign-admin', decision }
          : { origin: 'campaign-admin', decision, rejection_reason: rejectionReason },
      })

      return new Response(JSON.stringify({ success: true, campaign }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete') {
      const campaignId = String(body?.campaign_id ?? '').trim()
      if (!campaignId) throw new Error('campaign_id is required')

      const { data: current, error: fetchError } = await svc
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle()
      if (fetchError) throw fetchError
      if (!current) throw new Error('Campaign not found')

      const { error } = await svc.from('campaigns').delete().eq('id', campaignId)
      if (error) throw error

      await logAppAudit(svc, {
        area: 'causes',
        action: 'deleted',
        entityType: 'campaign',
        entityId: campaignId,
        actorId: user.id,
        beforeState: current,
        metadata: { origin: 'campaign-admin' },
      })

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'set_visibility') {
      const campaignId = String(body?.campaign_id ?? '').trim()
      const visibility = String(body?.visibility ?? '').trim()
      const reason = String(body?.reason ?? '').trim()
      if (!campaignId) throw new Error('campaign_id is required')
      if (!['public', 'hidden'].includes(visibility)) throw new Error("visibility must be 'public' or 'hidden'")

      const { data: current, error: fetchError } = await svc
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle()
      if (fetchError) throw fetchError
      if (!current) throw new Error('Campaign not found')

      const updates: Record<string, unknown> = visibility === 'hidden'
        ? {
            visibility: 'hidden',
            hidden_at: new Date().toISOString(),
            hidden_by: user.id,
            hidden_reason: reason || null,
          }
        : {
            visibility: 'public',
            hidden_at: null,
            hidden_by: null,
            hidden_reason: null,
          }

      const { data: campaign, error } = await svc
        .from('campaigns')
        .update(updates)
        .eq('id', campaignId)
        .select('*')
        .single()
      if (error) throw error

      await logAppAudit(svc, {
        area: 'causes',
        action: visibility === 'hidden' ? 'hidden' : 'unhidden',
        entityType: 'campaign',
        entityId: campaign.id,
        actorId: user.id,
        beforeState: current,
        afterState: campaign,
        metadata: { origin: 'campaign-admin', visibility, reason: reason || null },
      })

      return new Response(JSON.stringify({ success: true, campaign }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unsupported action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in campaign-admin:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
