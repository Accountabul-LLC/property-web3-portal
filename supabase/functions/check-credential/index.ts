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
    const { wallet_address, credential_key: inputCredentialKey, feature_key } = body as {
      wallet_address: string
      credential_key?: string
      feature_key?: string
    }

    if (!wallet_address) {
      return new Response(JSON.stringify({ error: 'wallet_address is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!inputCredentialKey && !feature_key) {
      return new Response(JSON.stringify({ error: 'At least one of credential_key or feature_key must be provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 1: Run expiry cleanup (fire and forget - don't block on error)
    serviceClient.rpc('expire_stale_credential_applications').then(() => {}).catch(() => {})

    // Step 2: Resolve credential_key from feature_key if needed
    let resolvedCredentialKey: string | null = inputCredentialKey ?? null

    if (!resolvedCredentialKey && feature_key) {
      const { data: routeRule } = await serviceClient
        .from('route_access_rules')
        .select('required_credential')
        .eq('route_key', feature_key)
        .maybeSingle()

      if (routeRule) {
        resolvedCredentialKey = routeRule.required_credential ?? null
      }
    }

    // Step 3: If no credential required for this route
    if (!resolvedCredentialKey) {
      const result = {
        is_eligible: true,
        blocking_reason: null,
        next_action: null,
        credential_key: null,
        credential_name: null,
        application_status: null,
      }

      // Log decision
      serviceClient.from('gate_decisions').insert({
        user_id: user.id,
        wallet_address,
        feature_key: feature_key ?? null,
        credential_key: null,
        is_eligible: true,
        blocking_reason: null,
        next_action: null,
        checked_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {})

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 4: Fetch credential catalog
    const { data: catalog } = await serviceClient
      .from('credential_catalog')
      .select('credential_key, credential_name, allowed_account_types, requires_kyc, requires_wallet')
      .eq('credential_key', resolvedCredentialKey)
      .maybeSingle()

    if (!catalog) {
      return new Response(JSON.stringify({ error: 'Credential type not found in catalog' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 5: Check wallet ownership
    const { data: wallet } = await serviceClient
      .from('user_wallets')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('wallet_address', wallet_address)
      .maybeSingle()

    if (!wallet) {
      const result = {
        is_eligible: false,
        blocking_reason: 'wallet_not_found',
        next_action: 'Connect your wallet to check credential eligibility.',
        credential_key: resolvedCredentialKey,
        credential_name: catalog.credential_name,
        application_status: null,
      }

      serviceClient.from('gate_decisions').insert({
        user_id: user.id,
        wallet_address,
        feature_key: feature_key ?? null,
        credential_key: resolvedCredentialKey,
        is_eligible: false,
        blocking_reason: 'wallet_not_found',
        next_action: result.next_action,
        checked_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {})

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 6: Check account type
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .maybeSingle()

    const accountType = profile?.account_type ?? 'individual'
    if (!catalog.allowed_account_types.includes(accountType)) {
      const result = {
        is_eligible: false,
        blocking_reason: 'account_type',
        next_action: 'This feature is not available for your account type.',
        credential_key: resolvedCredentialKey,
        credential_name: catalog.credential_name,
        application_status: null,
      }

      serviceClient.from('gate_decisions').insert({
        user_id: user.id,
        wallet_address,
        feature_key: feature_key ?? null,
        credential_key: resolvedCredentialKey,
        is_eligible: false,
        blocking_reason: 'account_type',
        next_action: result.next_action,
        checked_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {})

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 7: Fetch most recent credential application
    const { data: latestApp } = await serviceClient
      .from('credential_applications')
      .select('id, status, expires_at')
      .eq('user_id', user.id)
      .eq('credential_key', resolvedCredentialKey)
      .order('applied_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const credName = catalog.credential_name

    // Step 8: Determine eligibility
    let result: {
      is_eligible: boolean
      blocking_reason: string | null
      next_action: string | null
      credential_key: string
      credential_name: string
      application_status: string | null
    }

    if (!latestApp) {
      result = {
        is_eligible: false,
        blocking_reason: 'no_application',
        next_action: `Apply for ${credName} to access this feature.`,
        credential_key: resolvedCredentialKey,
        credential_name: credName,
        application_status: null,
      }
    } else {
      const status = latestApp.status

      if (status === 'applied' || status === 'under_review') {
        result = {
          is_eligible: false,
          blocking_reason: 'under_review',
          next_action: `Your ${credName} application is under review.`,
          credential_key: resolvedCredentialKey,
          credential_name: credName,
          application_status: status,
        }
      } else if (status === 'approved') {
        result = {
          is_eligible: false,
          blocking_reason: 'awaiting_issuance',
          next_action: `Approved. Awaiting credential issuance by Accountabul.`,
          credential_key: resolvedCredentialKey,
          credential_name: credName,
          application_status: status,
        }
      } else if (status === 'issued_pending_acceptance') {
        result = {
          is_eligible: false,
          blocking_reason: 'pending_acceptance',
          next_action: `Your ${credName} has been issued. Accept it in your wallet to proceed.`,
          credential_key: resolvedCredentialKey,
          credential_name: credName,
          application_status: status,
        }
      } else if (status === 'active') {
        result = {
          is_eligible: true,
          blocking_reason: null,
          next_action: null,
          credential_key: resolvedCredentialKey,
          credential_name: credName,
          application_status: status,
        }
      } else if (status === 'expired') {
        result = {
          is_eligible: false,
          blocking_reason: 'expired',
          next_action: `Your issued ${credName} expired after 48 hours. Request reissuance.`,
          credential_key: resolvedCredentialKey,
          credential_name: credName,
          application_status: status,
        }
      } else if (status === 'revoked') {
        result = {
          is_eligible: false,
          blocking_reason: 'revoked',
          next_action: `Your ${credName} credential has been revoked. Contact support.`,
          credential_key: resolvedCredentialKey,
          credential_name: credName,
          application_status: status,
        }
      } else if (status === 'rejected') {
        result = {
          is_eligible: false,
          blocking_reason: 'rejected',
          next_action: `Your ${credName} application was not approved. You may reapply.`,
          credential_key: resolvedCredentialKey,
          credential_name: credName,
          application_status: status,
        }
      } else {
        result = {
          is_eligible: false,
          blocking_reason: 'unknown',
          next_action: `Contact support for assistance with your ${credName} credential.`,
          credential_key: resolvedCredentialKey,
          credential_name: credName,
          application_status: status,
        }
      }
    }

    // Step 9: Log to gate_decisions (fire and forget)
    serviceClient.from('gate_decisions').insert({
      user_id: user.id,
      wallet_address,
      feature_key: feature_key ?? null,
      credential_key: resolvedCredentialKey,
      is_eligible: result.is_eligible,
      blocking_reason: result.blocking_reason,
      next_action: result.next_action,
      checked_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {})

    return new Response(JSON.stringify(result), {
      status: 200,
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
