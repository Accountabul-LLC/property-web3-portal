import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Authenticate the reviewer
    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Check that the caller is admin or compliance_officer
    const { data: isAdmin } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: isCompliance } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })

    if (!isAdmin && !isCompliance) {
      return new Response(JSON.stringify({ error: 'Forbidden: requires admin or compliance_officer role' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const actorRole = isAdmin ? 'admin' : 'compliance_officer'

    const body = await req.json()
    const { kyc_case_id, decision, reason } = body

    if (!kyc_case_id || !decision) {
      return new Response(JSON.stringify({ error: 'Missing required fields: kyc_case_id, decision' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!['approved', 'rejected'].includes(decision)) {
      return new Response(JSON.stringify({ error: 'decision must be "approved" or "rejected"' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (decision === 'rejected' && !reason) {
      return new Response(JSON.stringify({ error: 'reason is required when rejecting' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Fetch the case
    const { data: kycCase, error: caseError } = await serviceClient
      .from('kyc_cases')
      .select('id, status')
      .eq('id', kyc_case_id)
      .maybeSingle()

    if (caseError) throw caseError

    if (!kycCase) {
      return new Response(JSON.stringify({ error: 'KYC case not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (!['submitted', 'under_review'].includes(kycCase.status)) {
      return new Response(JSON.stringify({
        error: `Cannot review case in status: ${kycCase.status}`,
        current_status: kycCase.status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const now = new Date().toISOString()

    const updatePayload: Record<string, unknown> = {
      status: decision,
      reviewer_id: user.id,
      reviewed_at: now,
      updated_at: now,
    }

    if (decision === 'approved') {
      updatePayload.approved_at = now
    } else {
      updatePayload.rejection_reason = reason
    }

    const { error: updateError } = await serviceClient
      .from('kyc_cases')
      .update(updatePayload)
      .eq('id', kyc_case_id)

    if (updateError) throw updateError

    // Record history
    await serviceClient.from('kyc_status_history').insert({
      kyc_case_id,
      from_status: kycCase.status,
      to_status: decision,
      actor_id: user.id,
      actor_role: actorRole,
      reason: reason ?? null,
      metadata: { reviewed_at: now },
    })

    return new Response(JSON.stringify({
      kyc_case_id,
      status: decision,
      reviewed_at: now,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in kyc-admin-review:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
