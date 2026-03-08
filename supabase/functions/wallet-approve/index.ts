/**
 * wallet-approve  (admin / compliance officer only)
 *
 * ALL-OR-NOTHING approval + on-chain credential issuance.
 *
 * 1. Validates admin role
 * 2. Checks issuer wallet exists and seed is configured
 * 3. Issues CredentialCreate tx on XRPL
 * 4. Only if on-chain tx succeeds → approves registration + creates credential record
 *
 * If ANY step fails, nothing is committed — the registration stays pending.
 *
 * Body: { registration_id: string, notes?: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com']
const MAINNET_NODES = ['wss://s1.ripple.com', 'wss://s2.ripple.com', 'wss://xrplcluster.com']
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

async function xrplRequest(nodes: string[], method: string, params: Record<string, unknown>[]) {
  let lastError: Error | null = null
  for (const node of nodes) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
        const res = await fetch(node, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method, params }),
        })
        if (res.status === 429 || res.status === 503) {
          lastError = new Error(`${node} returned ${res.status}`)
          if (attempt < MAX_RETRIES) continue
          break
        }
        const text = await res.text()
        try {
          return JSON.parse(text)
        } catch {
          lastError = new Error(`Non-JSON from ${node}: ${text.slice(0, 120)}`)
          break
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        break
      }
    }
  }
  throw lastError || new Error('All XRPL nodes failed')
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
    if (wallet.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Target wallet is not active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Find active issuer for this wallet's network ─────────
    const network = wallet.network ?? 'testnet'
    const { data: issuer } = await serviceClient
      .from('xrpl_issuer_wallets')
      .select('id, issuer_address, secret_env_key')
      .eq('network', network)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!issuer) {
      return new Response(JSON.stringify({
        error: 'No active issuer wallet configured for this network. Set one up in the admin Credentials panel before approving.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 422,
      })
    }

    // ── Load issuer seed (NEVER from DB — env secret only) ───
    const issuerSeed = Deno.env.get(issuer.secret_env_key)
    if (!issuerSeed) {
      return new Response(JSON.stringify({
        error: `Issuer seed not configured. Set the secret '${issuer.secret_env_key}' in your backend secrets before approving wallets.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 422,
      })
    }

    // ── Derive issuer wallet and verify address match ─────────
    const { Wallet: XrplWallet } = await import('https://esm.sh/xrpl@4.1.0')
    const issuerWallet = XrplWallet.fromSeed(issuerSeed)

    if (issuerWallet.address !== issuer.issuer_address) {
      console.error(`Issuer mismatch: DB=${issuer.issuer_address}, seed derives=${issuerWallet.address}`)
      return new Response(JSON.stringify({
        error: 'Issuer address mismatch — the configured seed does not match the stored issuer address.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // ── Build, sign, and submit CredentialCreate ──────────────
    const nodes = network === 'mainnet' ? MAINNET_NODES : TESTNET_NODES
    const credentialType = 'ACCOUNTABUL_TRADE_APPROVED'
    const credentialTypeHex = toHex(credentialType)

    console.log(`Issuing credential: issuer=${issuer.issuer_address} → subject=${wallet.wallet_address}`)

    const [accountInfoRes, serverInfoRes] = await Promise.all([
      xrplRequest(nodes, 'account_info', [{ account: issuer.issuer_address, ledger_index: 'current' }]),
      xrplRequest(nodes, 'server_info', [{}]),
    ])

    if (accountInfoRes.result?.error) {
      return new Response(JSON.stringify({
        error: `Issuer account error: ${accountInfoRes.result.error_message || accountInfoRes.result.error}. Fund the issuer wallet first.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 422,
      })
    }

    const sequence = accountInfoRes.result.account_data.Sequence
    const validatedSeq = serverInfoRes.result?.info?.validated_ledger?.seq ?? 0

    const credentialCreateTx = {
      TransactionType: 'CredentialCreate',
      Account: issuer.issuer_address,
      Subject: wallet.wallet_address,
      CredentialType: credentialTypeHex,
      Fee: '12',
      Sequence: sequence,
      LastLedgerSequence: validatedSeq + 30,
    }

    const signed = issuerWallet.sign(credentialCreateTx)
    const submitResult = await xrplRequest(nodes, 'submit', [{ tx_blob: signed.tx_blob }])
    const engineResult: string = submitResult.result?.engine_result ?? 'unknown'
    const txHash: string = submitResult.result?.tx_json?.hash ?? signed.hash

    console.log(`CredentialCreate result: ${engineResult} hash=${txHash}`)

    // ── Check on-chain result — FAIL FAST if not successful ──
    if (engineResult !== 'tesSUCCESS') {
      const msg = submitResult.result?.engine_result_message ?? ''
      console.error(`On-chain issuance failed: ${engineResult} — ${msg}`)
      return new Response(JSON.stringify({
        error: `On-chain credential issuance failed: ${engineResult} — ${msg}. Registration NOT approved.`,
        engine_result: engineResult,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // ── ON-CHAIN SUCCESS → commit everything to DB ───────────
    const now = new Date().toISOString()

    // 1. Approve the registration
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

    // 2. Create wallet_credentials row (already issued)
    const { data: credRow, error: credInsertErr } = await serviceClient
      .from('wallet_credentials')
      .insert({
        wallet_id: wallet.id,
        wallet_registration_id: registration_id,
        issuer_wallet_id: issuer.id,
        issuer_address: issuer.issuer_address,
        credential_type: credentialType,
        credential_type_hex: credentialTypeHex,
        ledger_status: 'issued',
        issued_at: now,
        tx_hash: txHash,
      })
      .select('id, ledger_status')
      .single()
    if (credInsertErr) throw credInsertErr

    // 3. Assign TRADE_GLOBAL permission profile
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

    // 4. Update issuer timestamp
    await serviceClient.from('xrpl_issuer_wallets').update({
      updated_at: now,
    }).eq('id', issuer.id)

    return new Response(JSON.stringify({
      registration_id,
      registration_status: 'approved',
      credential_id: credRow.id,
      ledger_status: 'issued',
      tx_hash: txHash,
      engine_result: engineResult,
      subject_address: wallet.wallet_address,
      issuer_address: issuer.issuer_address,
      message: 'Wallet approved and credential issued on XRPL. The user can now accept it.',
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
