import { safeErrorMessage } from "../_shared/errors.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // ── Auth ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

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

    // ── Parse body ───────────────────────────────────────────
    const body = await req.json()
    const { wallet_address } = body
    if (!wallet_address) {
      return new Response(JSON.stringify({ error: 'Missing required field: wallet_address' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Run all checks in parallel ───────────────────────────
    const [
      kycResult,
      walletResult,
      isTradeEnabledResult,
    ] = await Promise.all([
      serviceClient.rpc('get_kyc_status', { p_user_id: user.id }),
      serviceClient
        .from('user_wallets')
        .select('id, status, user_id')
        .eq('wallet_address', wallet_address)
        .maybeSingle(),
      serviceClient.rpc('is_wallet_trade_enabled', { p_wallet_address: wallet_address }),
    ])

    const kycStatus: string = kycResult.data ?? 'not_started'

    // Wallet must belong to this user
    const walletRow = walletResult.data
    let walletStatus = 'not_found'
    let walletId: string | null = null
    if (walletRow) {
      if (walletRow.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden: wallet does not belong to your account' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        })
      }
      walletStatus = walletRow.status
      walletId = walletRow.id
    }

    const isTradeEnabled: boolean = isTradeEnabledResult.data ?? false

    // ── Registration status ──────────────────────────────────
    let registrationStatus = 'not_started'
    let registrationId: string | null = null
    if (walletId) {
      const { data: regRow } = await serviceClient
        .from('wallet_registrations')
        .select('id, registration_status')
        .eq('wallet_id', walletId)
        .maybeSingle()
      if (regRow) {
        registrationStatus = regRow.registration_status
        registrationId = regRow.id
      }
    }

    // ── Credential status (most recent) ─────────────────────
    let credentialStatus = 'none'
    let credentialId: string | null = null
    if (walletId) {
      const { data: credRow } = await serviceClient
        .from('wallet_credentials')
        .select('id, ledger_status')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (credRow) {
        credentialStatus = credRow.ledger_status
        credentialId = credRow.id
      }
    }

    // ── Permission profiles ──────────────────────────────────
    let permissionProfiles: string[] = []
    if (walletId) {
      const { data: assignments } = await serviceClient
        .from('wallet_permission_assignments')
        .select('permission_profile_code')
        .eq('wallet_id', walletId)
        .eq('status', 'active')
      if (assignments) {
        permissionProfiles = assignments.map((a: any) => a.permission_profile_code)
      }
    }

    const response: Record<string, unknown> = {
      wallet_address,
      is_trade_enabled: isTradeEnabled,
      kyc_status: kycStatus,
      wallet_status: walletStatus,
      registration_status: registrationStatus,
      credential_status: credentialStatus,
      permission_profiles: permissionProfiles,
    }
    if (registrationId) response.registration_id = registrationId
    if (credentialId) response.credential_id = credentialId

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in compliance-check:', error)
    return new Response(JSON.stringify({ error: safeErrorMessage(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
