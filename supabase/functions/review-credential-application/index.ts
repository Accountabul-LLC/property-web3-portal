import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Check admin or compliance_officer role
    const { data: isAdmin } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: isCompliance } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
    if (!isAdmin && !isCompliance) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { application_id, action, rejection_reason, notes } = body as {
      application_id: string
      action: 'start_review' | 'approve' | 'reject' | 'issue'
      rejection_reason?: string
      notes?: string
    }

    if (!application_id || !action) {
      return new Response(JSON.stringify({ error: 'application_id and action are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch current application
    const { data: app, error: fetchError } = await serviceClient
      .from('credential_applications')
      .select('*, credential_catalog(credential_name, maps_to_xrpl_code)')
      .eq('id', application_id)
      .single()

    if (fetchError || !app) {
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()

    if (action === 'start_review') {
      const { data: updated, error: updateError } = await serviceClient
        .from('credential_applications')
        .update({ status: 'under_review', updated_at: now, ...(notes ? { notes } : {}) })
        .eq('id', application_id)
        .select()
        .single()

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to update application', details: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ application: updated }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'approve') {
      const { data: updated, error: updateError } = await serviceClient
        .from('credential_applications')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: now,
          updated_at: now,
          ...(notes ? { notes } : {}),
        })
        .eq('id', application_id)
        .select()
        .single()

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to approve application', details: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ application: updated }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'reject') {
      if (!rejection_reason) {
        return new Response(JSON.stringify({ error: 'rejection_reason is required for reject action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: updated, error: updateError } = await serviceClient
        .from('credential_applications')
        .update({
          status: 'rejected',
          rejection_reason,
          reviewed_by: user.id,
          reviewed_at: now,
          updated_at: now,
          ...(notes ? { notes } : {}),
        })
        .eq('id', application_id)
        .select()
        .single()

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to reject application', details: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ application: updated }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'issue') {
      if (app.status !== 'approved') {
        return new Response(JSON.stringify({ error: 'Application must be in approved status to issue credential' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const issuedAt = new Date()
      const expiresAt = new Date(issuedAt.getTime() + 48 * 60 * 60 * 1000)

      // Create wallet_credentials row
      const { data: walletCred, error: credError } = await serviceClient
        .from('wallet_credentials')
        .insert({
          user_id: app.user_id,
          wallet_id: null, // will be linked by wallet_address lookup
          credential_type: app.credential_key,
          ledger_status: 'pending_issuance',
          issued_at: issuedAt.toISOString(),
        })
        .select('id')
        .single()

      if (credError || !walletCred) {
        return new Response(JSON.stringify({ error: 'Failed to create wallet credential record', details: credError?.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Update application
      const { data: updated, error: updateError } = await serviceClient
        .from('credential_applications')
        .update({
          status: 'issued_pending_acceptance',
          issued_at: issuedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          wallet_credential_id: walletCred.id,
          reviewed_by: user.id,
          reviewed_at: now,
          updated_at: now,
          ...(notes ? { notes } : {}),
        })
        .eq('id', application_id)
        .select()
        .single()

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to update application to issued status', details: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({
          application: updated,
          credential: walletCred,
          message: 'Credential issued. User must accept within 48 hours.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
