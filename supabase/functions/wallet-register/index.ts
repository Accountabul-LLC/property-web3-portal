/**
 * wallet-register
 *
 * User requests that one of their connected wallets be registered for trading.
 * Preconditions checked server-side:
 *   1. User is authenticated
 *   2. KYC status is 'approved'
 *   3. Wallet exists, belongs to this user, and is active
 *   4. Wallet is not already registered (or was previously rejected → allow retry)
 *
 * Body: { wallet_id: string }
 * Returns: { registration_id, registration_status }
 */

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

    // ── KYC gate ─────────────────────────────────────────────
    const { data: kycStatus, error: kycError } = await serviceClient
      .rpc('get_kyc_status', { p_user_id: user.id })
    if (kycError) throw kycError
    if (kycStatus !== 'approved') {
      return new Response(JSON.stringify({
        error: 'Identity verification must be approved before registering a wallet for trading.',
        kyc_status: kycStatus,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // ── Parse body ───────────────────────────────────────────
    const body = await req.json()
    const { wallet_id } = body
    if (!wallet_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: wallet_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Verify wallet belongs to user and is active ──────────
    const { data: wallet, error: walletError } = await serviceClient
      .from('user_wallets')
      .select('id, wallet_address, status')
      .eq('id', wallet_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (walletError) throw walletError
    if (!wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found or does not belong to your account.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }
    if (wallet.status !== 'active') {
      return new Response(JSON.stringify({ error: `Wallet status is '${wallet.status}'. Only active wallets can be registered.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Check for existing registration ──────────────────────
    const { data: existing, error: regError } = await serviceClient
      .from('wallet_registrations')
      .select('id, registration_status')
      .eq('wallet_id', wallet_id)
      .maybeSingle()
    if (regError) throw regError

    if (existing) {
      if (['pending', 'under_review', 'approved'].includes(existing.registration_status)) {
        return new Response(JSON.stringify({
          error: `Wallet already has a registration in status: ${existing.registration_status}`,
          registration_id: existing.id,
          registration_status: existing.registration_status,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        })
      }
      // rejected or revoked → allow re-registration by updating existing row
      const { data: updated, error: updateErr } = await serviceClient
        .from('wallet_registrations')
        .update({
          registration_status: 'pending',
          reviewer_id: null,
          reviewed_at: null,
          revoked_at: null,
          revocation_reason: null,
          notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id, registration_status')
        .single()
      if (updateErr) throw updateErr
      return new Response(JSON.stringify({
        registration_id: updated.id,
        registration_status: updated.registration_status,
        wallet_address: wallet.wallet_address,
        message: 'Re-registration request submitted and pending compliance review.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // ── Capture KYC snapshot ─────────────────────────────────
    const { data: kycCase } = await serviceClient
      .from('kyc_cases')
      .select('id, status, approved_at, expires_at')
      .eq('user_id', user.id)
      .maybeSingle()

    // ── Create registration ──────────────────────────────────
    const { data: registration, error: insertError } = await serviceClient
      .from('wallet_registrations')
      .insert({
        wallet_id,
        user_id: user.id,
        registration_status: 'pending',
        kyc_case_id: kycCase?.id ?? null,
        kyc_snapshot: kycCase
          ? { status: kycCase.status, approved_at: kycCase.approved_at, expires_at: kycCase.expires_at }
          : null,
      })
      .select('id, registration_status')
      .single()
    if (insertError) throw insertError

    return new Response(JSON.stringify({
      registration_id: registration.id,
      registration_status: registration.registration_status,
      wallet_address: wallet.wallet_address,
      message: 'Registration request submitted. Pending compliance review.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })

  } catch (error) {
    console.error('Error in wallet-register:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
