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
import { logAppAudit } from '../_shared/app-audit.ts'

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const fallbackOrigin = Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.com'
  const allowed = /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com)$/i.test(origin)
    || origin === fallbackOrigin
    || origin === 'https://accountabul.com'

  return {
    'Access-Control-Allow-Origin': allowed ? origin : fallbackOrigin,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Vary': 'Origin',
  }
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
  const corsHeaders = buildCors(req)

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
    let { data: payloadRow, error: payloadErr } = await svc
      .from('xaman_payloads')
      .select('metadata, network, status')
      .eq('uuid', xaman_uuid)
      .maybeSingle()

    if (payloadErr) {
      console.error('xaman_payloads select error:', payloadErr)
      throw payloadErr
    }
    if (!payloadRow) {
      const { data: donationRow, error: donationErr } = await svc
        .from('campaign_donations')
        .select('campaign_id, donor_user_id, donor_wallet_address, amount, donor_message, is_anonymous, escrow_status')
        .eq('xaman_payload_uuid', xaman_uuid)
        .maybeSingle()

      if (donationErr) throw donationErr
      if (!donationRow) {
        return new Response(JSON.stringify({ error: 'Payload not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (donationRow.donor_user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: campaignForPayload, error: campaignForPayloadErr } = await svc
        .from('campaigns')
        .select('network, release_date, campaign_type')
        .eq('id', donationRow.campaign_id)
        .maybeSingle()

      if (campaignForPayloadErr) throw campaignForPayloadErr

      const amountXrp = Number(donationRow.amount ?? 0)
      payloadRow = {
        status: donationRow.escrow_status === 'pending' ? 'pending' : donationRow.escrow_status,
        network: campaignForPayload?.network ?? 'mainnet',
        metadata: {
          purpose: 'CAMPAIGN_DONATION',
          campaign_id: donationRow.campaign_id,
          campaign_network: campaignForPayload?.network ?? 'mainnet',
          campaign_type: campaignForPayload?.campaign_type ?? 'escrow',
          intended_user_id: donationRow.donor_user_id,
          donor_user_id: donationRow.donor_user_id,
          donor_wallet_address: donationRow.donor_wallet_address,
          amount_xrp: amountXrp,
          drops: String(Math.round(amountXrp * 1_000_000)),
          donor_message: donationRow.donor_message ?? null,
          is_anonymous: donationRow.is_anonymous ?? false,
        },
      }

      await svc.from('xaman_payloads').insert({
        uuid: xaman_uuid,
        status: payloadRow.status,
        wallet_address: donationRow.donor_wallet_address,
        network: payloadRow.network,
        metadata: payloadRow.metadata,
      })
    }

    // Ownership check — only the donor who created this payload can poll it
    const intendedUserId = (payloadRow.metadata as any)?.intended_user_id
      ?? (payloadRow.metadata as any)?.donor_user_id
      ?? null
    if (intendedUserId && intendedUserId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Already settled — return cached status without re-querying Xaman
    const isDirectDonation = (payloadRow.metadata as any)?.purpose === 'CAMPAIGN_DONATION_DIRECT'
      || (payloadRow.metadata as any)?.campaign_type === 'direct'

    if (payloadRow.status === 'signed') {
      return new Response(JSON.stringify({ status: isDirectDonation ? 'released' : 'escrowed' }), {
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

      await logAppAudit(svc, {
        area: 'causes',
        action: newStatus,
        entityType: 'campaign_donation',
        actorId: user.id,
        metadata: {
          origin: 'campaign-check-donation',
          xaman_uuid,
          status: newStatus,
        },
      })

      return new Response(JSON.stringify({ status: newStatus }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // Signed payloads must be validated on-ledger before we mark escrowed.
    const meta: any = payloadRow.metadata ?? {}
    const network = payloadRow.network ?? 'mainnet'

    const { data: campaign, error: campaignErr } = await svc
      .from('campaigns')
      .select('recipient_wallet_address, campaign_type')
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

    // Detect on-ledger failure (tec*, tef*, ter*, tem*, tel*) — signed in Xaman but rejected by the XRP Ledger
    const engineResult: string = txData?.meta?.TransactionResult ?? 'unknown'
    if (engineResult !== 'tesSUCCESS') {
      const friendly =
        engineResult === 'tecNO_PERMISSION'
          ? 'The XRP Ledger rejected this transaction: the escrow release time has not been reached yet, or the cancel window has already passed. No funds were moved.'
          : `The XRP Ledger rejected this transaction (${engineResult}). No funds were moved.`

      await Promise.all([
        svc.from('xaman_payloads').update({ status: 'failed' }).eq('uuid', xaman_uuid),
        svc.from('campaign_donations')
          .update({ escrow_status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('xaman_payload_uuid', xaman_uuid),
      ])

      await logAppAudit(svc, {
        area: 'causes',
        action: 'escrow_failed',
        entityType: 'campaign_donation',
        actorId: user.id,
        metadata: {
          origin: 'campaign-check-donation',
          xaman_uuid,
          campaign_id: meta.campaign_id,
          tx_hash: txHash,
          engine_result: engineResult,
        },
      })

      return new Response(JSON.stringify({
        status: 'failed',
        engine_result: engineResult,
        message: friendly,
        tx_hash: txHash,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const expectedDrops = String(meta.drops ?? Math.round(Number(meta.amount_xrp ?? 0) * 1_000_000))
    const txAmount = typeof txData.Amount === 'string' ? txData.Amount : String(txData.Amount ?? '')
    const txDestination = txData.Destination ?? ''

    const expectedType = campaign.campaign_type === 'direct' ? 'Payment' : 'EscrowCreate'
    if (txData.TransactionType !== expectedType || txAmount !== expectedDrops || txDestination !== campaign.recipient_wallet_address) {
      return new Response(JSON.stringify({
        error: 'Validated XRPL transaction did not match the expected escrow payload',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()

    const newDonationStatus = campaign.campaign_type === 'direct' ? 'released' : 'escrowed'
    await Promise.all([
      svc.from('xaman_payloads').update({
        status: 'signed',
        wallet_address: xamanData.response?.account ?? null,
        signed_at: now,
      }).eq('uuid', xaman_uuid),
      svc.from('campaign_donations').update({
        escrow_status: newDonationStatus,
        escrow_tx_hash: txHash,
        escrow_sequence: campaign.campaign_type === 'direct' ? null : escrowSequence,
        updated_at: now,
      }).eq('xaman_payload_uuid', xaman_uuid),
    ])

    await logAppAudit(svc, {
      area: 'causes',
      action: campaign.campaign_type === 'direct' ? 'direct_donation_released' : 'escrowed',
      entityType: 'campaign_donation',
      actorId: user.id,
      metadata: {
        origin: 'campaign-check-donation',
        xaman_uuid,
        campaign_id: meta.campaign_id,
        tx_hash: txHash,
        escrow_sequence: escrowSequence,
      },
    })

    console.log(`Donation escrowed: campaign=${meta.campaign_id} amount=${meta.amount_xrp} XRP tx=${txHash} seq=${escrowSequence}`)

    return new Response(JSON.stringify({
      status: newDonationStatus,
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
