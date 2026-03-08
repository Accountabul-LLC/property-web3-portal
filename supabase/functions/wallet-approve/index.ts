/**
 * wallet-approve  (admin / compliance officer only)
 *
 * Approves a pending wallet registration and creates a wallet_credentials
 * row in state 'pending_issuance'.
 *
 * Does NOT sign or submit any XRPL transaction.
 * Credential issuance is handled separately by issue-testnet-credential,
 * keeping the issuer key isolated in the Edge Function runtime and never
 * touched by the approval flow itself.
 *
 * Body: { registration_id: string, notes?: string }
 *
 * Returns: {
 *   registration_id, registration_status: 'approved',
 *   credential_id, ledger_status: 'pending_issuance'
 * }
 *
 * Also assigns the TRADE_GLOBAL permission profile to the wallet
 * (reflects intent — full trade access gates on credential acceptance).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

Deno.serve(async (req) => {
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

    // ── Role check ───────────────────────────────────────────
    const { data: isAdmin } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: isCompliance } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
    if (!isAdmin && !isCompliance) {
      return new Response(JSON.stringify({ error: 'Forbidden: requires admin or compliance_officer role' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // ── Parse body ───────────────────────────────────────────
    const body = await req.json()
    const { registration_id, notes } = body
    if (!registration_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: registration_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Fetch registration ───────────────────────────────────
    const { data: registration, error: regError } = await serviceClient
      .from('wallet_registrations')
      .select('id, registration_status, wallet_id, user_id')
      .eq('id', registration_id)
      .maybeSingle()
    if (regError) throw regError
    if (!registration) {
      return new Response(JSON.stringify({ error: 'Registration not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }
    if (!['pending', 'under_review'].includes(registration.registration_status)) {
      return new Response(JSON.stringify({
        error: `Cannot approve registration in status: ${registration.registration_status}`,
        registration_status: registration.registration_status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Fetch wallet ─────────────────────────────────────────
    const { data: wallet, error: walletError } = await serviceClient
      .from('user_wallets')
      .select('id, wallet_address, network, status')
      .eq('id', registration.wallet_id)
      .single()
    if (walletError) throw walletError

    // ── Find active issuer for this wallet's network ─────────
    const { data: issuer, error: issuerError } = await serviceClient
      .from('xrpl_issuer_wallets')
      .select('id, issuer_address, secret_env_key')
      .eq('network', wallet.network ?? 'testnet')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (issuerError) throw issuerError

    const now = new Date().toISOString()

    // ── Approve the registration ─────────────────────────────
    await serviceClient
      .from('wallet_registrations')
      .update({
        registration_status: 'approved',
        reviewer_id: user.id,
        reviewed_at: now,
        notes: notes ?? null,
        updated_at: now,
      })
      .eq('id', registration_id)

    // ── Create wallet_credentials row (pending_issuance) ─────
    const credentialType = 'ACCOUNTABUL_TRADE_APPROVED'
    const { data: credRow, error: credInsertErr } = await serviceClient
      .from('wallet_credentials')
      .insert({
        wallet_id: wallet.id,
        wallet_registration_id: registration_id,
        issuer_wallet_id: issuer?.id ?? null,
        issuer_address: issuer?.issuer_address ?? 'NOT_CONFIGURED',
        credential_type: credentialType,
        credential_type_hex: toHex(credentialType),
        ledger_status: 'pending_issuance',
      })
      .select('id, ledger_status')
      .single()
    if (credInsertErr) throw credInsertErr

    // ── Assign TRADE_GLOBAL permission profile ───────────────
    await serviceClient
      .from('wallet_permission_assignments')
      .upsert({
        wallet_id: wallet.id,
        permission_profile_code: 'TRADE_GLOBAL',
        status: 'active',
        granted_by: user.id,
        starts_at: now,
        updated_at: now,
      }, { onConflict: 'wallet_id,permission_profile_code' })

    const noIssuerWarning = !issuer
      ? ' No active issuer wallet found for this network — configure one before issuing the credential.'
      : ''

    return new Response(JSON.stringify({
      registration_id,
      registration_status: 'approved',
      credential_id: credRow.id,
      ledger_status: 'pending_issuance',
      issuer_configured: !!issuer,
      message: `Registration approved. Call issue-testnet-credential with credential_id to issue the XRPL credential.${noIssuerWarning}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in wallet-approve:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
