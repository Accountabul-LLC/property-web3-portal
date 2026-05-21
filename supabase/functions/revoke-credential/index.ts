/**
 * revoke-credential  (admin / compliance officer only)
 *
 * Revokes an accepted XRPL credential by submitting a CredentialDelete transaction.
 * Either the issuer or the subject can delete a credential on XRPL.
 * This function always signs as the issuer (platform-controlled key).
 *
 * After deletion the credential is invalid on-ledger and
 * is_wallet_trade_enabled() returns false for that wallet.
 *
 * Body: { credential_id: string, reason?: string }
 * Returns: { ledger_status: 'deleted', tx_hash }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com']
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

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
        try { return JSON.parse(text) } catch {
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
    const { credential_id, reason } = body
    if (!credential_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: credential_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Fetch credential ─────────────────────────────────────
    const { data: credential, error: credError } = await serviceClient
      .from('wallet_credentials')
      .select(`
        id, ledger_status, credential_type_hex, issuer_address, issuer_wallet_id,
        wallet_id,
        user_wallets!inner ( id, wallet_address, network )
      `)
      .eq('id', credential_id)
      .maybeSingle()
    if (credError) throw credError
    if (!credential) {
      return new Response(JSON.stringify({ error: 'Credential not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const revocableStatuses = ['issued', 'accepted']
    if (!revocableStatuses.includes(credential.ledger_status)) {
      return new Response(JSON.stringify({
        error: `Credential in status '${credential.ledger_status}' cannot be revoked. Only issued or accepted credentials can be deleted.`,
        ledger_status: credential.ledger_status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const wallet = (credential as any).user_wallets

    // ── Load issuer seed ─────────────────────────────────────
    let secretEnvKey = 'XRPL_TESTNET_ISSUER_SEED'
    if (credential.issuer_wallet_id) {
      const { data: iw } = await serviceClient
        .from('xrpl_issuer_wallets')
        .select('secret_env_key, issuer_address')
        .eq('id', credential.issuer_wallet_id)
        .single()
      if (iw) secretEnvKey = iw.secret_env_key
    }

    const issuerSeed = Deno.env.get(secretEnvKey)
    if (!issuerSeed) {
      return new Response(JSON.stringify({
        error: `Issuer seed not found. Set the Supabase secret '${secretEnvKey}'.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // ── Build and sign CredentialDelete ──────────────────────
    const { Wallet: XrplWallet } = await import('npm:xrpl@3.1.0')
    const issuerWallet = XrplWallet.fromSeed(issuerSeed)

    const nodes = TESTNET_NODES

    const [accountInfoRes, serverInfoRes] = await Promise.all([
      xrplRequest(nodes, 'account_info', [{ account: issuerWallet.address, ledger_index: 'current' }]),
      xrplRequest(nodes, 'server_info', [{}]),
    ])

    if (accountInfoRes.result?.error) {
      throw new Error(`Issuer account error: ${accountInfoRes.result.error_message || accountInfoRes.result.error}`)
    }

    const validatedSeq = serverInfoRes.result?.info?.validated_ledger?.seq ?? 0

    // Issuer deletes the credential (signed as issuer)
    const credentialDeleteTx = {
      TransactionType: 'CredentialDelete',
      Account: issuerWallet.address,
      Subject: wallet.wallet_address,
      CredentialType: credential.credential_type_hex,
      Fee: '12',
      Sequence: accountInfoRes.result.account_data.Sequence,
      LastLedgerSequence: validatedSeq + 30,
    }

    console.log('Revoking credential for', wallet.wallet_address, JSON.stringify(credentialDeleteTx))
    const signed = issuerWallet.sign(credentialDeleteTx)
    const submitResult = await xrplRequest(nodes, 'submit', [{ tx_blob: signed.tx_blob }])
    const engineResult: string = submitResult.result?.engine_result ?? 'unknown'
    const txHash: string = submitResult.result?.tx_json?.hash ?? signed.hash

    const now = new Date().toISOString()

    if (engineResult !== 'tesSUCCESS' && !engineResult.startsWith('tec')) {
      await serviceClient.from('wallet_credentials').update({
        error_detail: `Revoke failed: ${engineResult}: ${submitResult.result?.engine_result_message ?? ''}`,
        updated_at: now,
      }).eq('id', credential_id)

      return new Response(JSON.stringify({
        error: `CredentialDelete failed: ${engineResult}`,
        engine_result: engineResult,
        ledger_status: credential.ledger_status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // ── Update DB ────────────────────────────────────────────
    await serviceClient.from('wallet_credentials').update({
      ledger_status: 'deleted',
      error_detail: reason ? `Revoked: ${reason}` : 'Revoked by admin',
      updated_at: now,
    }).eq('id', credential_id)

    // Revoke the wallet's TRADE_GLOBAL permission assignment
    await serviceClient.from('wallet_permission_assignments').update({
      status: 'revoked',
      ends_at: now,
      updated_at: now,
    })
    .eq('wallet_id', credential.wallet_id)
    .eq('permission_profile_code', 'TRADE_GLOBAL')
    .eq('status', 'active')

    return new Response(JSON.stringify({
      ledger_status: 'deleted',
      credential_id,
      tx_hash: txHash,
      engine_result: engineResult,
      message: 'Credential revoked. The wallet is no longer trade-enabled.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in revoke-credential:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
