import { createCorsHeaders } from '../_shared/cors.ts';
import { safeErrorMessage } from "../_shared/errors.ts";
/**
 * credential-accept
 *
 * The user accepts an issued XRPL credential on-ledger.
 * A credential is only valid after both CredentialCreate (by issuer) AND
 * CredentialAccept (by subject) have been submitted to XRPL.
 *
 * Testnet wallets:
 *   Auto-signs the CredentialAccept tx when the browser supplies the
 *   ephemeral testnet seed for the current session.
 *
 * Mainnet wallets (Xaman):
 *   Creates a Xaman payload for the user to sign in the Xaman app.
 *   Returns QR code URL + websocket_url for polling.
 *   Call xaman-check-payload to detect signing completion, then call
 *   credential-accept-confirm to finalize the ledger_status update.
 *
 * Body: { credential_id: string }
 *
 * Returns (testnet): { ledger_status: 'accepted', tx_hash }
 * Returns (mainnet): { ledger_status: 'issued', xaman_uuid, qr_code, websocket_url }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { requireKyc } from '../_shared/require-kyc.ts'

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
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    // SEC-014: hard KYC gate.
    const kycGate = await requireKyc(user.id, corsHeaders)
    if (kycGate instanceof Response) return kycGate

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // ── Parse body ───────────────────────────────────────────
    const body = await req.json()
    const { credential_id } = body
    if (!credential_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: credential_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── Fetch credential + wallet (verify ownership) ─────────
    const { data: credential, error: credError } = await serviceClient
      .from('wallet_credentials')
      .select(`
        id, ledger_status, issuer_address, credential_type, credential_type_hex,
        wallet_id,
        user_wallets!inner (
          id, wallet_address, user_id, provider, wallet_secret, network, status
        )
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

    const wallet = (credential as any).user_wallets
    if (wallet.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: credential does not belong to your wallet' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    if (wallet.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Wallet is not active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    if (credential.ledger_status !== 'issued') {
      return new Response(JSON.stringify({
        error: `Credential cannot be accepted in status: ${credential.ledger_status}. It must be 'issued' first.`,
        ledger_status: credential.ledger_status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const credentialAcceptTx = {
      TransactionType: 'CredentialAccept',
      Account: wallet.wallet_address,
      Issuer: credential.issuer_address,
      CredentialType: credential.credential_type_hex,
      Fee: '12',
    }

    // ── Testnet: auto-sign ────────────────────────────────────
    if (wallet.network === 'testnet' && wallet.wallet_secret) {
      const { Wallet: XrplWallet } = await import('npm:xrpl@3.1.0')
      const subjectWallet = XrplWallet.fromSeed(wallet.wallet_secret)

      const accountInfo = await xrplRequest(TESTNET_NODES, 'account_info', [
        { account: wallet.wallet_address, ledger_index: 'current' },
      ])
      if (accountInfo.result?.error) {
        throw new Error(`Account error: ${accountInfo.result.error_message || accountInfo.result.error}`)
      }

      const serverInfo = await xrplRequest(TESTNET_NODES, 'server_info', [{}])
      const validatedSeq = serverInfo.result?.info?.validated_ledger?.seq || 0

      const completeTx = {
        ...credentialAcceptTx,
        Sequence: accountInfo.result.account_data.Sequence,
        LastLedgerSequence: validatedSeq + 30,
      }

      console.log('Accepting credential:', JSON.stringify(completeTx))
      const signed = subjectWallet.sign(completeTx)
      const submitResult = await xrplRequest(TESTNET_NODES, 'submit', [{ tx_blob: signed.tx_blob }])
      const engineResult = submitResult.result?.engine_result
      const txHash = submitResult.result?.tx_json?.hash || signed.hash

      if (engineResult !== 'tesSUCCESS' && !engineResult?.startsWith('tec')) {
        await serviceClient.from('wallet_credentials').update({
          ledger_status: 'failed',
          updated_at: new Date().toISOString(),
        }).eq('id', credential_id)

        return new Response(JSON.stringify({
          ledger_status: 'failed',
          error: `CredentialAccept failed: ${engineResult}`,
          engine_result: engineResult,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      const acceptedAt = new Date().toISOString()
      await serviceClient.from('wallet_credentials').update({
        ledger_status: 'accepted',
        accepted_at: acceptedAt,
        tx_hash: txHash,
        updated_at: acceptedAt,
      }).eq('id', credential_id)

      return new Response(JSON.stringify({
        ledger_status: 'accepted',
        tx_hash: txHash,
        engine_result: engineResult,
        accepted_at: acceptedAt,
        message: 'Credential accepted. Wallet is now trade-enabled.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // ── Mainnet: create Xaman payload ─────────────────────────
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY')
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET')
    if (!xamanApiKey || !xamanApiSecret) {
      return new Response(JSON.stringify({ error: 'Xaman API credentials not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const xamanPayload = {
      txjson: credentialAcceptTx,
      options: {
        submit: true,
        expire: 600,
        return_url: {
          web: Deno.env.get('APP_URL') || 'https://accountabul.com',
        },
      },
      custom_meta: {
        identifier: `credential_accept_${credential_id}`,
        blob: {
          purpose: 'CREDENTIAL_ACCEPT',
          credential_id,
          credential_type: credential.credential_type,
        },
      },
    }

    const xamanRes = await fetch('https://xaman.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': xamanApiKey,
        'X-API-Secret': xamanApiSecret,
      },
      body: JSON.stringify(xamanPayload),
    })

    if (!xamanRes.ok) {
      const text = await xamanRes.text()
      throw new Error(`Xaman API error: ${xamanRes.status} — ${text}`)
    }

    const xamanData = await xamanRes.json()

    // Store payload (reuse xaman_payloads table)
    await serviceClient.from('xaman_payloads').insert({
      uuid: xamanData.uuid,
      status: 'pending',
      metadata: {
        purpose: 'CREDENTIAL_ACCEPT',
        credential_id,
        credential_type: credential.credential_type,
        user_id: user.id,
      },
    })

    return new Response(JSON.stringify({
      ledger_status: 'issued',
      xaman_uuid: xamanData.uuid,
      qr_code: xamanData.refs?.qr_png,
      websocket_url: xamanData.refs?.websocket_status,
      message: 'Scan the QR code in Xaman to accept your trading credential on-ledger.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in credential-accept:', error)
    return new Response(JSON.stringify({ error: safeErrorMessage(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
