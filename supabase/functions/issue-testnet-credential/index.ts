/**
 * issue-testnet-credential  (admin / compliance officer only)
 *
 * Issues an XRPL CredentialCreate transaction from the platform issuer wallet
 * to the subject (user) wallet.
 *
 * Security model:
 *   • The issuer seed is NEVER stored in any Postgres table.
 *   • It is stored only as a Supabase project secret (set in Dashboard → Secrets).
 *   • This function loads it via Deno.env.get(issuer.secret_env_key) at runtime.
 *   • The secret is scoped to Edge Function execution only — never returned or logged.
 *
 * Preconditions:
 *   • caller is admin or compliance_officer
 *   • wallet_credentials row exists with ledger_status = 'pending_issuance'
 *   • issuer wallet is configured and active for the credential's network
 *   • XRPL_TESTNET_ISSUER_SEED (or the configured secret_env_key) is set
 *
 * Body: { credential_id: string }
 *
 * Returns: { ledger_status: 'issued', tx_hash, engine_result }
 *
 * After this call, the subject wallet must call credential-accept to finalise
 * the credential on-ledger (CredentialAccept tx from the user's wallet).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    const { credential_id } = body
    if (!credential_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: credential_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Fetch credential + wallet + issuer ───────────────────
    const { data: credential, error: credError } = await serviceClient
      .from('wallet_credentials')
      .select(`
        id, ledger_status, credential_type, credential_type_hex,
        issuer_address, issuer_wallet_id,
        wallet_id,
        user_wallets!inner ( id, wallet_address, network, status )
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
    if (credential.ledger_status !== 'pending_issuance') {
      return new Response(JSON.stringify({
        error: `Credential cannot be issued in status: ${credential.ledger_status}`,
        ledger_status: credential.ledger_status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const wallet = (credential as any).user_wallets
    if (wallet.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Target wallet is not active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Resolve issuer ───────────────────────────────────────
    let issuerRecord: { id: string; issuer_address: string; secret_env_key: string } | null = null

    if (credential.issuer_wallet_id) {
      const { data: iw } = await serviceClient
        .from('xrpl_issuer_wallets')
        .select('id, issuer_address, secret_env_key')
        .eq('id', credential.issuer_wallet_id)
        .single()
      issuerRecord = iw
    } else {
      // Fallback: find active issuer for this network
      const { data: iw } = await serviceClient
        .from('xrpl_issuer_wallets')
        .select('id, issuer_address, secret_env_key')
        .eq('network', wallet.network ?? 'testnet')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      issuerRecord = iw
    }

    if (!issuerRecord) {
      return new Response(JSON.stringify({
        error: 'No active issuer wallet configured for this network. Register one in the admin Credentials panel.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // ── Load issuer seed from environment (NEVER from DB) ────
    const issuerSeed = Deno.env.get(issuerRecord.secret_env_key)
    if (!issuerSeed) {
      return new Response(JSON.stringify({
        error: `Issuer seed not found. Set the Supabase secret '${issuerRecord.secret_env_key}' in your project secrets.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // ── Build and sign CredentialCreate ──────────────────────
    const { Wallet: XrplWallet } = await import('npm:xrpl@3.1.0')
    const issuerWallet = XrplWallet.fromSeed(issuerSeed)

    // Guard: derived address must match the stored issuer address
    if (issuerWallet.address !== issuerRecord.issuer_address) {
      console.error(
        `Issuer address mismatch: DB has ${issuerRecord.issuer_address}, seed derives ${issuerWallet.address}`
      )
      return new Response(JSON.stringify({
        error: 'Issuer address mismatch — seed does not match stored issuer address. Check your secret configuration.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const nodes = TESTNET_NODES // Phase 1A: testnet only

    const [accountInfoRes, serverInfoRes] = await Promise.all([
      xrplRequest(nodes, 'account_info', [{ account: issuerRecord.issuer_address, ledger_index: 'current' }]),
      xrplRequest(nodes, 'server_info', [{}]),
    ])

    if (accountInfoRes.result?.error) {
      throw new Error(
        `Issuer account error: ${accountInfoRes.result.error_message || accountInfoRes.result.error}. ` +
        `Fund the issuer wallet on testnet first.`
      )
    }

    const sequence = accountInfoRes.result.account_data.Sequence
    const validatedSeq = serverInfoRes.result?.info?.validated_ledger?.seq ?? 0

    const credentialCreateTx = {
      TransactionType: 'CredentialCreate',
      Account: issuerRecord.issuer_address,
      Subject: wallet.wallet_address,
      CredentialType: credential.credential_type_hex,
      Fee: '12',
      Sequence: sequence,
      LastLedgerSequence: validatedSeq + 30,
    }

    console.log('Issuing credential to', wallet.wallet_address, JSON.stringify(credentialCreateTx))
    const signed = issuerWallet.sign(credentialCreateTx)
    const submitResult = await xrplRequest(nodes, 'submit', [{ tx_blob: signed.tx_blob }])
    const engineResult: string = submitResult.result?.engine_result ?? 'unknown'
    const txHash: string = submitResult.result?.tx_json?.hash ?? signed.hash

    // ── Update DB ────────────────────────────────────────────
    const now = new Date().toISOString()
    const issuanceSuccess = engineResult === 'tesSUCCESS' || engineResult.startsWith('tec')

    if (!issuanceSuccess) {
      await serviceClient.from('wallet_credentials').update({
        ledger_status: 'failed',
        updated_at: now,
      }).eq('id', credential_id)

      return new Response(JSON.stringify({
        ledger_status: 'failed',
        engine_result: engineResult,
        error: `CredentialCreate failed: ${engineResult} — ${submitResult.result?.engine_result_message ?? ''}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    await serviceClient.from('wallet_credentials').update({
      ledger_status: 'issued',
      issuer_wallet_id: issuerRecord.id,
      issuer_address: issuerRecord.issuer_address,
      issued_at: now,
      tx_hash: txHash,
      updated_at: now,
    }).eq('id', credential_id)

    // Update issuer updated_at
    await serviceClient.from('xrpl_issuer_wallets').update({
      updated_at: now,
    }).eq('id', issuerRecord.id)

    return new Response(JSON.stringify({
      ledger_status: 'issued',
      credential_id,
      tx_hash: txHash,
      engine_result: engineResult,
      subject_address: wallet.wallet_address,
      message: 'Credential issued on XRPL. The user must now accept it via credential-accept.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in issue-testnet-credential:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
