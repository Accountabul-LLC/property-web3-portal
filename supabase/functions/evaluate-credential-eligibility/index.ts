import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com)$/i.test(origin)
    || origin === (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app'),
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Vary': 'Origin',
  };
}Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
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

    const body = await req.json()
    const { wallet_address, credential_keys, force_recompute, target_user_id } = body as {
      wallet_address: string
      credential_keys?: string[]
      force_recompute?: boolean
      target_user_id?: string
    }

    if (!wallet_address) {
      return new Response(JSON.stringify({ error: 'wallet_address is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin can evaluate on behalf of another user
    let evaluatedUserId = user.id
    if (target_user_id && target_user_id !== user.id) {
      const { data: isAdmin } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      const { data: isCompliance } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
      if (!isAdmin && !isCompliance) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions to evaluate another user' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      evaluatedUserId = target_user_id
    }

    // Expire stale applications first
    await serviceClient.rpc('expire_stale_credential_applications' as any)

    // Load all context in parallel
    const [
      profileResult,
      kycResult,
      walletResult,
      walletRegResult,
      kycDocsResult,
      existingAppsResult,
      catalogResult,
    ] = await Promise.all([
      serviceClient
        .from('profiles' as any)
        .select('account_type')
        .eq('id', evaluatedUserId)
        .single(),
      serviceClient.rpc('get_kyc_status', { p_user_id: evaluatedUserId }),
      serviceClient
        .from('user_wallets' as any)
        .select('id, wallet_address, network, status, signature_verified_at')
        .eq('user_id', evaluatedUserId)
        .eq('wallet_address', wallet_address)
        .maybeSingle(),
      serviceClient
        .from('wallet_registrations' as any)
        .select('id, registration_status, wallet_address')
        .eq('user_id', evaluatedUserId)
        .eq('wallet_address', wallet_address)
        .maybeSingle(),
      (async () => {
        // Get kyc_case first, then docs
        const { data: kycCase } = await serviceClient
          .from('kyc_cases' as any)
          .select('id')
          .eq('user_id', evaluatedUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!kycCase) return { data: [] }
        return serviceClient
          .from('kyc_documents' as any)
          .select('id, doc_type, status, metadata')
          .eq('kyc_case_id', (kycCase as any).id)
          .eq('status', 'accepted')
      })(),
      serviceClient
        .from('credential_applications' as any)
        .select('id, credential_key, status, expires_at, wallet_credential_id')
        .eq('user_id', evaluatedUserId)
        .eq('wallet_address', wallet_address)
        .not('status', 'in', '("rejected","expired","revoked")'),
      (async () => {
        let query = serviceClient
          .from('credential_catalog' as any)
          .select(`
            credential_key, credential_name, credential_class, is_active,
            allowed_account_types, maps_to_xrpl_code,
            credential_requirements (
              requirement_key, artifact_type, artifact_subtype,
              check_mode, display_label, display_hint, is_blocking, sort_order
            )
          `)
          .eq('is_active', true)
        if (credential_keys && credential_keys.length > 0) {
          query = query.in('credential_key', credential_keys)
        }
        return query
      })(),
    ])

    const profile = profileResult.data as any
    const kycStatus = kycResult.data as string | null
    const wallet = walletResult.data as any
    const walletReg = walletRegResult.data as any
    const kycDocs = (kycDocsResult as any).data ?? []
    const existingApps = (existingAppsResult.data ?? []) as any[]
    const catalog = (catalogResult.data ?? []) as any[]

    // Build account type
    const accountType: string = profile?.account_type ?? 'individual'

    // Build live_facts Set
    const liveFacts = new Set<string>()

    if (accountType === 'individual') liveFacts.add('account_type_individual')
    if (accountType === 'business') liveFacts.add('account_type_business')
    if (kycStatus === 'approved') liveFacts.add('kyc_approved')
    if (wallet && walletReg?.registration_status === 'approved') liveFacts.add('wallet_registered')
    if (wallet?.signature_verified_at) liveFacts.add('wallet_ownership_proven')

    // Map kyc_documents to facts
    for (const doc of kycDocs) {
      const docType: string = doc.doc_type ?? ''
      const artifactSubtype: string | null = doc.metadata?.artifact_subtype ?? null

      if (docType === 'government_id' || docType === 'gov_id') {
        liveFacts.add('gov_id_uploaded')
      }
      if (docType === 'proof_of_address') {
        liveFacts.add('proof_of_address_uploaded')
      }
      if (docType === 'business_registration' || (artifactSubtype === 'business_reg')) {
        liveFacts.add('business_registration_doc::business_reg')
      }
      if (docType === 'professional_license' || docType === 'license') {
        if (artifactSubtype === 'appraiser_license') {
          liveFacts.add('professional_license_doc::appraiser_license')
        } else if (artifactSubtype === 'notary_license') {
          liveFacts.add('professional_license_doc::notary_license')
        }
        // Without subtype, add the generic key too
        if (!artifactSubtype) {
          liveFacts.add('professional_license_doc')
        }
      }
    }

    // Build app lookup by credential_key
    const appsByKey = new Map<string, any>()
    for (const app of existingApps) {
      appsByKey.set(app.credential_key, app)
    }

    const evaluatedAt = new Date().toISOString()
    const results: any[] = []
    const upsertRows: any[] = []

    for (const entry of catalog) {
      const credentialKey: string = entry.credential_key
      const credentialClass: 'A' | 'B' = entry.credential_class ?? 'B'
      const allowedAccountTypes: string[] = entry.allowed_account_types ?? ['individual', 'business']
      const requirements: any[] = (entry.credential_requirements ?? []).sort(
        (a: any, b: any) => a.sort_order - b.sort_order
      )

      const wrongAccountType = !allowedAccountTypes.includes(accountType)

      // Evaluate each requirement
      const reqResults: any[] = []
      let allAutoMet = true
      let hasManualRequirements = false
      let allBlockingMet = true
      const blockingReasons: string[] = []

      for (const req of requirements) {
        const factKey = req.artifact_subtype
          ? `${req.artifact_type}::${req.artifact_subtype}`
          : req.artifact_type
        const met = liveFacts.has(factKey)

        if (req.check_mode === 'auto' && !met) allAutoMet = false
        if (req.check_mode === 'manual') hasManualRequirements = true
        if (req.is_blocking && !met) {
          allBlockingMet = false
          blockingReasons.push(req.display_hint ?? req.display_label)
        }

        reqResults.push({
          requirement_key: req.requirement_key,
          artifact_type: req.artifact_type,
          check_mode: req.check_mode,
          display_label: req.display_label,
          display_hint: req.display_hint ?? null,
          met,
          is_blocking: req.is_blocking,
        })
      }

      // If no requirements at all, treat as met
      if (requirements.length === 0) {
        allAutoMet = true
        allBlockingMet = true
      }

      // Determine ui_section
      const existingApp = appsByKey.get(credentialKey)
      let uiSection: string

      if (existingApp) {
        const appStatus: string = existingApp.status
        if (['active', 'applied', 'under_review', 'approved'].includes(appStatus)) {
          uiSection = 'active'
        } else if (appStatus === 'issued_pending_acceptance') {
          uiSection = 'ready_to_accept'
        } else {
          // Fallback — shouldn't occur due to the NOT IN filter
          uiSection = 'active'
        }
      } else if (wrongAccountType) {
        uiSection = 'unavailable'
      } else if (credentialClass === 'A') {
        uiSection = allAutoMet ? 'auto_issuable' : 'needs_more_info'
      } else {
        // Class B
        uiSection = (allAutoMet && allBlockingMet) ? 'eligible_apply' : 'needs_more_info'
      }

      const resultObj: any = {
        credential_key: credentialKey,
        credential_name: entry.credential_name,
        credential_class: credentialClass,
        ui_section: uiSection,
        all_auto_met: allAutoMet,
        has_manual_requirements: hasManualRequirements,
        all_blocking_met: allBlockingMet,
        blocking_reasons: blockingReasons,
        requirements: reqResults,
      }

      if (existingApp) {
        resultObj.existing_application = {
          id: existingApp.id,
          status: existingApp.status,
          expires_at: existingApp.expires_at ?? null,
          wallet_credential_id: existingApp.wallet_credential_id ?? null,
        }
      }

      results.push(resultObj)

      upsertRows.push({
        user_id: evaluatedUserId,
        wallet_address,
        credential_key: credentialKey,
        ui_section: uiSection,
        requirements_snapshot: reqResults,
        all_auto_met: allAutoMet,
        has_manual_requirements: hasManualRequirements,
        all_blocking_met: allBlockingMet,
        blocking_reasons: blockingReasons,
        computed_at: evaluatedAt,
      })
    }

    // Upsert all rows into credential_eligibility
    if (upsertRows.length > 0) {
      await serviceClient
        .from('credential_eligibility' as any)
        .upsert(upsertRows, {
          onConflict: 'user_id,credential_key,wallet_address',
          ignoreDuplicates: false,
        })
    }

    return new Response(
      JSON.stringify({ wallet_address, evaluated_at: evaluatedAt, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
