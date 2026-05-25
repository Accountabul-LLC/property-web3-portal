/**
 * campaign-check-donation
 *
 * Polls Xaman for the status of a donation EscrowCreate signing payload.
 * Called by the frontend every 3s after showing the QR code.
 *
 * On signed:
 *   - Looks up the XRPL transaction to get the escrow sequence number
 *   - Updates campaign_donations: escrow_status = 'escrowed', tx_hash, sequence
 *   - The donor_count + total_raised are updated automatically by DB trigger
 *
 * On cancelled/expired:
 *   - Marks donation row as 'cancelled'
 *
 * Body: { xaman_uuid }
 * Returns: { status: 'pending' | 'escrowed' | 'cancelled' | 'expired', tx_hash? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const XRPL_NODES = {
  mainnet: 'https://xrplcluster.com',
  testnet: 'https://s.altnet.rippletest.net:51234',
  devnet:  'https://s.devnet.rippletest.net:51234',
}

async function fetchXrplTx(txHash: string, network: string): Promise<any> {
  const node = XRPL_NODES[network as keyof typeof XRPL_NODES] ?? XRPL_NODES.mainnet
  try {
    const res = await fetch(node, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tx',
        params: [{ transaction: txHash, binary: false }],
      }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.result ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY')!
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET')!

    // ── Auth ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const svc = createClient(supabaseUrl, supabaseServiceKey)

    const { xaman_uuid } = await req.json()
    if (!xaman_uuid) {
      return new Response(JSON.stringify({ error: 'Missing xaman_uuid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Load our payload row ──────────────────────────────────
    const { data: payloadRow } = await svc
      .from('xaman_payloads')
      .select('intended_user_id, metadata, network, status')
      .eq('uuid', xaman_uuid)
      .maybeSingle()

    if (!payloadRow) {
      return new Response(JSON.stringify({ error: 'Payload not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Ownership check — only the donor who created this payload can poll it
    if (payloadRow.intended_user_id && payloadRow.intended_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Already settled — return cached status without re-querying Xaman
    if (payloadRow.status === 'signed') {
      return new Response(JSON.stringify({ status: 'escrowed' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (payloadRow.status === 'cancelled') {
      return new Response(JSON.stringify({ status: 'cancelled' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (payloadRow.status === 'expired') {
      return new Response(JSON.stringify({ status: 'expired' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Poll Xaman ────────────────────────────────────────────
    const xamanRes = await fetch(`https://xaman.app/api/v1/platform/payload/${xaman_uuid}`, {
      headers: { 'X-API-Key': xamanApiKey, 'X-API-Secret': xamanApiSecret },
    })

    if (!xamanRes.ok) throw new Error(`Xaman API error: ${xamanRes.status}`)
    const xamanData = await xamanRes.json()

    const signed    = xamanData.meta?.signed    === true
    const cancelled = xamanData.meta?.cancelled === true
    const expired   = xamanData.meta?.expired   === true
    const txHash    = xamanData.response?.txid  ?? null

    console.log(`Donation payload ${xaman_uuid}: signed=${signed} cancelled=${cancelled} expired=${expired} txHash=${txHash}`)

    // ── Not yet resolved ──────────────────────────────────────
    if (!signed && !cancelled && !expired) {
      return new Response(JSON.stringify({ status: 'pending' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Cancelled or expired ──────────────────────────────────
    if (cancelled || expired) {
      const newStatus = cancelled ? 'cancelled' : 'expired'

      await Promise.all([
        svc.from('xaman_payloads')
          .update({ status: newStatus })
          .eq('uuid', xaman_uuid),
        svc.from('campaign_donations')
          .update({ escrow_status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('xaman_payload_uuid', xaman_uuid),
      ])

      return new Response(JSON.stringify({ status: newStatus }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // Signed payloads must be validated on-ledger before we mark escrowed.
    const meta: any = payloadRow.metadata ?? {}
    const network = payloadRow.network ?? 'mainnet'

    const { data: campaign, error: campaignErr } = await svc
      .from('campaigns')
      .select('recipient_wallet_address')
      .eq('id', meta.campaign_id)
      .maybeSingle()

    if (campaignErr) throw campaignErr
    if (!campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found for donation payload' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let escrowSequence: number | null = null
    let txData: any = null
    if (txHash) {
      txData = await fetchXrplTx(txHash, network)
      if (txData?.Sequence !== undefined) {
        escrowSequence = txData.Sequence
      }
      console.log(`Fetched escrow sequence from XRPL: ${escrowSequence}`)
    }

    if (!txData || txData.validated !== true) {
      return new Response(JSON.stringify({ status: 'pending' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const expectedDrops = String(meta.drops ?? Math.round(Number(meta.amount_xrp ?? 0) * 1_000_000))
    const txAmount = typeof txData.Amount === 'string' ? txData.Amount : String(txData.Amount ?? '')
    const txDestination = txData.Destination ?? ''

    if (txData.TransactionType !== 'EscrowCreate' || txAmount !== expectedDrops || txDestination !== campaign.recipient_wallet_address) {
      return new Response(JSON.stringify({
        error: 'Validated XRPL transaction did not match the expected escrow payload',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()

    await Promise.all([
      svc.from('xaman_payloads').update({
        status: 'signed',
        wallet_address: xamanData.response?.account ?? null,
        signed_at: now,
      }).eq('uuid', xaman_uuid),
      svc.from('campaign_donations').update({
        escrow_status: 'escrowed',
        escrow_tx_hash: txHash,
        escrow_sequence: escrowSequence,
        updated_at: now,
      }).eq('xaman_payload_uuid', xaman_uuid),
    ])

    console.log(`Donation escrowed: campaign=${meta.campaign_id} amount=${meta.amount_xrp} XRP tx=${txHash} seq=${escrowSequence}`)

    return new Response(JSON.stringify({
      status: 'escrowed',
      tx_hash: txHash,
      escrow_sequence: escrowSequence,
      amount_xrp: meta.amount_xrp,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in campaign-check-donation:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
