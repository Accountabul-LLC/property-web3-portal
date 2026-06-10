import { createCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));
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
      action: 'start_review' | 'approve' | 'reject' | 'issue' | 'get_evidence'
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
    const { data: userProfile } = await serviceClient
      .from('profiles')
      .select('id, company_name')
      .eq('id', app.user_id)
      .maybeSingle()

    async function syncVendorVerification(isVerified: boolean) {
      if (app.credential_key !== 'vendor') return
      const status = isVerified ? 'verified' : 'rejected'
      const { error: vendorError } = await serviceClient
        .from('vendor_profiles')
        .upsert({
          user_id: app.user_id,
          profile_id: userProfile?.id ?? app.user_id,
          company_name: userProfile?.company_name ?? 'Vendor',
          verification_status: status,
          reviewed_at: now,
          verified_at: isVerified ? now : null,
          updated_at: now,
        }, { onConflict: 'user_id' })

      if (vendorError) {
        console.warn('Failed to sync vendor verification flag:', vendorError.message)
      }

      const { error: professionalError } = await serviceClient
        .from('professionals')
        .update({ verified: isVerified })
        .eq('wallet_address', app.wallet_address)

      if (professionalError) {
        console.warn('Failed to sync professional verification flag:', professionalError.message)
      }
    }

    if (action === 'start_review') {
      const { data: updated, error: updateError } = await serviceClient
        .from('credential_applications')
        .update({ status: 'under_review', ...(notes ? { notes } : {}) })
        .eq('id', application_id)
        .select()
        .single()

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to update application', details: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (app.credential_key === 'vendor') {
        await serviceClient
          .from('vendor_profiles')
          .upsert({
            user_id: app.user_id,
            profile_id: userProfile?.id ?? app.user_id,
            company_name: userProfile?.company_name ?? 'Vendor',
            verification_status: 'under_review',
            reviewed_at: now,
            updated_at: now,
          }, { onConflict: 'user_id' })
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
          reviewed_at: now,
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

      await syncVendorVerification(true)

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
          reviewed_at: now,
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

      await syncVendorVerification(false)

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

      // Look up the user's wallet_id from wallet_address
      const { data: userWallet, error: walletError } = await serviceClient
        .from('user_wallets')
        .select('id')
        .eq('wallet_address', app.wallet_address)
        .eq('user_id', app.user_id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (walletError || !userWallet) {
        return new Response(JSON.stringify({ error: 'Could not find active wallet for this user/address', details: walletError?.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Look up an active issuer wallet
      const { data: issuerWallet, error: issuerError } = await serviceClient
        .from('xrpl_issuer_wallets')
        .select('id, issuer_address')
        .eq('status', 'active')
        .limit(1)
        .single()

      if (issuerError || !issuerWallet) {
        return new Response(JSON.stringify({ error: 'No active issuer wallet configured', details: issuerError?.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const issuedAt = new Date()
      const expiresAt = new Date(issuedAt.getTime() + 48 * 60 * 60 * 1000)

      // Create wallet_credentials row with correct columns
      const { data: walletCred, error: credError } = await serviceClient
        .from('wallet_credentials')
        .insert({
          wallet_id: userWallet.id,
          credential_type: app.credential_key,
          issuer_address: issuerWallet.issuer_address,
          issuer_wallet_id: issuerWallet.id,
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
          reviewed_at: now,
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

      await syncVendorVerification(true)

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

    if (action === 'get_evidence') {
      // Fetch the credential_key from the application
      const { data: evidenceApp } = await serviceClient
        .from('credential_applications' as any)
        .select('credential_key, user_id, wallet_address')
        .eq('id', application_id)
        .single()

      if (!evidenceApp) {
        return new Response(JSON.stringify({ error: 'Application not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const eApp = evidenceApp as any

      // Fetch manual requirements for this credential
      const { data: manualReqs } = await serviceClient
        .from('credential_requirements' as any)
        .select('requirement_key, display_label, artifact_type, artifact_subtype')
        .eq('credential_key', eApp.credential_key)
        .eq('check_mode', 'manual')
        .order('sort_order')

      // Fetch kyc_case for this user
      const { data: kycCase } = await serviceClient
        .from('kyc_cases' as any)
        .select('id')
        .eq('user_id', eApp.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let documents: any[] = []
      if (kycCase) {
        const { data: docs } = await serviceClient
          .from('kyc_documents' as any)
          .select('id, doc_type, file_name, storage_path, status, uploaded_at, metadata')
          .eq('kyc_case_id', (kycCase as any).id)
          .order('uploaded_at', { ascending: false })
        documents = docs ?? []
      }

      // Build evidence structure
      const evidence = (manualReqs ?? []).map((req: any) => ({
        requirement_key: req.requirement_key,
        display_label: req.display_label,
        artifact_type: req.artifact_type,
        artifact_subtype: req.artifact_subtype,
        documents: documents.filter((doc: any) => {
          if (!req.artifact_subtype) return doc.doc_type === 'other'
          return doc.metadata?.artifact_subtype === req.artifact_subtype
        }),
      }))

      return new Response(
        JSON.stringify({ evidence, kyc_case_id: kycCase ? (kycCase as any).id : null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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
