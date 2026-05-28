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
    const { credential_key, wallet_address } = body as { credential_key: string; wallet_address: string }

    if (!credential_key || !wallet_address) {
      return new Response(JSON.stringify({ error: 'credential_key and wallet_address are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch credential catalog entry
    const { data: catalog, error: catalogError } = await serviceClient
      .from('credential_catalog')
      .select('*')
      .eq('credential_key', credential_key)
      .single()

    if (catalogError || !catalog) {
      return new Response(JSON.stringify({ error: 'Credential type not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!catalog.is_active) {
      return new Response(JSON.stringify({ error: 'This credential type is not currently available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check account type
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, account_type, company_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accountType = profile.account_type ?? 'individual'
    if (!catalog.allowed_account_types.includes(accountType)) {
      return new Response(JSON.stringify({ error: 'This credential is not available for your account type' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check KYC if required
    if (catalog.requires_kyc) {
      const { data: kycStatus, error: kycError } = await serviceClient.rpc('get_kyc_status', { p_user_id: user.id })
      if (kycError) {
        return new Response(JSON.stringify({ error: 'Failed to check KYC status' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (kycStatus !== 'approved') {
        return new Response(JSON.stringify({ error: 'KYC verification must be approved before applying for credentials' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Verify wallet ownership and active status
    if (catalog.requires_wallet) {
      const { data: wallet, error: walletError } = await serviceClient
        .from('user_wallets')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('wallet_address', wallet_address)
        .single()

      if (walletError || !wallet) {
        return new Response(JSON.stringify({ error: 'Wallet not found or does not belong to your account' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (wallet.status !== 'active') {
        return new Response(JSON.stringify({ error: 'Wallet must be active to apply for credentials' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Check for existing non-terminal application
    const { data: existingApp, error: existingError } = await serviceClient
      .from('credential_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('credential_key', credential_key)
      .not('status', 'in', '("rejected","expired","revoked")')
      .maybeSingle()

    if (existingError) {
      return new Response(JSON.stringify({ error: 'Failed to check existing applications' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (existingApp) {
      return new Response(
        JSON.stringify({
          error: `You already have an active application for this credential`,
          current_status: existingApp.status,
          application_id: existingApp.id,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Insert new application
    const { data: newApp, error: insertError } = await serviceClient
      .from('credential_applications')
      .insert({
        user_id: user.id,
        wallet_address,
        credential_key,
        status: 'applied',
        applied_at: new Date().toISOString(),
      })
      .select('id, status, credential_key')
      .single()

    if (insertError || !newApp) {
      return new Response(JSON.stringify({ error: 'Failed to create application', details: insertError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (credential_key === 'VENDOR_MARKETPLACE_APPROVED') {
      const { error: vendorError } = await serviceClient
        .from('vendor_profiles')
        .upsert({
          user_id: user.id,
          profile_id: profile.id,
          company_name: profile.company_name ?? catalog.credential_name,
          verification_status: 'requested',
          requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (vendorError) {
        console.warn('Failed to sync vendor request status:', vendorError.message)
      }
    }

    return new Response(
      JSON.stringify({
        application_id: newApp.id,
        status: 'applied',
        credential_key: newApp.credential_key,
        message: `Your application for ${catalog.credential_name} has been submitted and is under review.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
