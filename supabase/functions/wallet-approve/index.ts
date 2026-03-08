/**
 * wallet-approve  (admin / compliance officer only)
 *
 * ALL-OR-NOTHING approval + on-chain credential issuance via Xaman signing.
 *
 * Flow:
 *   1. Validates admin role & registration status
 *   2. Finds the issuer wallet for the network
 *   3. Builds a CredentialCreate tx JSON
 *   4. Sends it to Xaman API as a payload for the admin to sign
 *   5. Returns the Xaman QR code / deep link — frontend polls for signature
 *   6. The check-credential-payload function handles the post-sign commit
 *
 * Body: { registration_id: string, notes?: string }
 *
 * Returns: { xaman_uuid, qr_code, registration_id, credential_meta }
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
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY')
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET')

    if (!xamanApiKey || !xamanApiSecret) {
      return new Response(JSON.stringify({ error: 'Xaman API credentials not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      })
    }

    // ── Auth ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // ── Role check ───────────────────────────────────────────
    const { data: isAdmin } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: isCompliance } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
    if (!isAdmin && !isCompliance) {
      return new Response(JSON.stringify({ error: 'Forbidden: requires admin or compliance_officer role' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
      })
    }

    // ── Parse body ───────────────────────────────────────────
    const body = await req.json()
    const { registration_id, notes } = body
    if (!registration_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: registration_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      })
    }
    if (!['pending', 'under_review'].includes(registration.registration_status)) {
      return new Response(JSON.stringify({
        error: `Cannot approve registration in status: ${registration.registration_status}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    // ── Fetch target wallet ──────────────────────────────────
    const { data: wallet, error: walletError } = await serviceClient
      .from('user_wallets')
      .select('id, wallet_address, network, status')
      .eq('id', registration.wallet_id)
      .single()
    if (walletError) throw walletError
    if (wallet.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Target wallet is not active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    // ── Find active issuer for this network ──────────────────
    const network = wallet.network ?? 'testnet'
    const { data: issuer } = await serviceClient
      .from('xrpl_issuer_wallets')
      .select('id, issuer_address')
      .eq('network', network)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!issuer) {
      return new Response(JSON.stringify({
        error: 'No active issuer wallet configured for this network. Set one up in admin before approving.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422,
      })
    }

    // ── Build CredentialCreate tx ─────────────────────────────
    const credentialType = 'ACCOUNTABUL_TRADE_APPROVED'
    const credentialTypeHex = toHex(credentialType)

    const txjson: Record<string, unknown> = {
      TransactionType: 'CredentialCreate',
      Account: issuer.issuer_address,
      Subject: wallet.wallet_address,
      CredentialType: credentialTypeHex,
    }

    console.log(`Building CredentialCreate: issuer=${issuer.issuer_address} → subject=${wallet.wallet_address}`)

    // ── Send to Xaman for signing ────────────────────────────
    const xamanPayload = {
      txjson,
      options: {
        submit: true,
        expire: 300,
        return_url: {
          web: Deno.env.get('APP_URL') || 'https://accountabul.com',
        },
      },
      custom_meta: {
        identifier: `cred_${registration_id.slice(0, 8)}`,
      },
    }

    const xamanResponse = await fetch('https://xaman.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': xamanApiKey,
        'X-API-Secret': xamanApiSecret,
      },
      body: JSON.stringify(xamanPayload),
    })

    const xamanText = await xamanResponse.text()
    if (!xamanResponse.ok) {
      console.error('Xaman API error:', xamanResponse.status, xamanText)
      throw new Error(`Xaman API error: ${xamanResponse.status}`)
    }

    const xamanData = JSON.parse(xamanText)
    console.log('Xaman credential payload created:', xamanData.uuid)

    // Store payload reference + all metadata needed by check-credential-payload
    const { error: payloadInsertErr } = await serviceClient.from('xaman_payloads').insert({
      uuid: xamanData.uuid,
      status: 'pending',
      network,
      metadata: {
        purpose: 'CREDENTIAL_ISSUE',
        registration_id,
        wallet_id: wallet.id,
        issuer_wallet_id: issuer.id,
        issuer_address: issuer.issuer_address,
        subject_address: wallet.wallet_address,
        credential_type: credentialType,
        credential_type_hex: credentialTypeHex,
        admin_user_id: user.id,
        notes: notes ?? null,
      },
    })
    if (payloadInsertErr) {
      console.error('Failed to store payload metadata:', payloadInsertErr)
      throw payloadInsertErr
    }

    // Mark registration as under_review while awaiting signature
    await serviceClient.from('wallet_registrations').update({
      registration_status: 'under_review',
      updated_at: new Date().toISOString(),
    }).eq('id', registration_id)

    return new Response(JSON.stringify({
      xaman_uuid: xamanData.uuid,
      qr_code: xamanData.refs?.qr_png,
      deep_link: xamanData.next?.always,
      websocket_url: xamanData.refs?.websocket_status,
      registration_id,
      issuer_address: issuer.issuer_address,
      subject_address: wallet.wallet_address,
      message: 'Sign the CredentialCreate transaction in Xaman to approve this wallet.',
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
