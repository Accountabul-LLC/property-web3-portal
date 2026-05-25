/**
 * campaign-donate
 *
 * Builds an XRPL EscrowCreate transaction for a campaign donation and sends
 * it to Xaman for the donor to sign. The escrow locks funds until the
 * campaign's release_date, then releases directly to the recipient wallet.
 *
 * Flow:
 *   1. Auth + validate campaign is active
 *   2. Get donor's connected wallet (must have one)
 *   3. Build EscrowCreate tx (Amount in drops, FinishAfter in XRPL epoch time)
 *   4. Send to Xaman → get QR code
 *   5. Store xaman_payloads row (bound to user)
 *   6. Create pending campaign_donations row
 *   7. Return { xaman_uuid, qr_code, deep_link }
 *
 * Body: { campaign_id, amount (XRP), donor_message?, is_anonymous? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

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

// XRPL epoch starts Jan 1, 2000 — Unix epoch offset in seconds
const RIPPLE_EPOCH_OFFSET = 946684800

function toDrops(xrp: number): string {
  return String(Math.round(xrp * 1_000_000))
}

function toXrplTime(isoDate: string): number {
  const unixSeconds = Math.floor(new Date(isoDate).getTime() / 1000)
  return unixSeconds - RIPPLE_EPOCH_OFFSET
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
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY')
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET')

    if (!xamanApiKey || !xamanApiSecret) {
      throw new Error('Xaman API credentials not configured')
    }

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

    // ── Parse + validate body ─────────────────────────────────
    const body = await req.json()
    const { campaign_id, amount, donor_message, is_anonymous } = body

    if (!campaign_id || !amount) {
      return new Response(JSON.stringify({ error: 'Missing campaign_id or amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const xrpAmount = parseFloat(amount)
    if (isNaN(xrpAmount) || xrpAmount < 1) {
      return new Response(JSON.stringify({ error: 'Minimum donation is 1 XRP' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch campaign ────────────────────────────────────────
    const { data: campaign, error: campaignErr } = await svc
      .from('campaigns')
      .select('id, title, slug, status, network, recipient_wallet_address, release_date, currency')
      .eq('id', campaign_id)
      .maybeSingle()

    if (campaignErr) throw campaignErr
    if (!campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (campaign.status !== 'active') {
      return new Response(JSON.stringify({ error: `Campaign is not accepting donations (status: ${campaign.status})` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (campaign.network !== 'mainnet' && campaign.network !== 'testnet') {
      return new Response(JSON.stringify({ error: 'Campaign network is not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (new Date(campaign.release_date) <= new Date()) {
      return new Response(JSON.stringify({ error: 'Campaign release date has already passed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Get donor's active wallet ─────────────────────────────
    const { data: wallet } = await svc
      .from('user_wallets')
      .select('wallet_address, network')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!wallet) {
      return new Response(JSON.stringify({ error: 'No active wallet connected. Please connect your Xaman wallet first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (wallet.network !== campaign.network) {
      return new Response(JSON.stringify({
        error: `Connected wallet network (${wallet.network ?? 'unknown'}) must match the campaign network (${campaign.network}).`,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Build EscrowCreate tx ─────────────────────────────────
    const finishAfter = toXrplTime(campaign.release_date)
    const drops = toDrops(xrpAmount)

    const txjson = {
      TransactionType: 'EscrowCreate',
      Account: wallet.wallet_address,
      Amount: drops,
      Destination: campaign.recipient_wallet_address,
      FinishAfter: finishAfter,
    }

    console.log(`Building EscrowCreate: ${wallet.wallet_address} → ${campaign.recipient_wallet_address} | ${xrpAmount} XRP (${drops} drops) | FinishAfter: ${finishAfter}`)

    // ── Send to Xaman ─────────────────────────────────────────
    const xamanPayload = {
      txjson,
      options: {
        submit: true,
        expire: 300,
        return_url: {
          web: `${Deno.env.get('APP_URL') ?? 'https://accountabul.com'}/causes/${campaign.slug}`,
        },
      },
      custom_meta: {
        identifier: `donation_${campaign_id.slice(0, 8)}_${Date.now().toString(36)}`,
        blob: JSON.stringify({
          purpose: 'CAMPAIGN_DONATION',
          campaign_id,
          campaign_title: campaign.title,
          amount_xrp: xrpAmount,
        }),
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

    const xamanText = await xamanRes.text()
    if (!xamanRes.ok) {
      console.error('Xaman API error:', xamanRes.status, xamanText)
      throw new Error(`Xaman API error: ${xamanRes.status}`)
    }

    const xamanData = JSON.parse(xamanText)
    console.log('Xaman donation payload created:', xamanData.uuid)

    // ── Store xaman_payloads (bound to user, SEC-004) ─────────
    await svc.from('xaman_payloads').insert({
      uuid: xamanData.uuid,
      status: 'pending',
      intended_user_id: user.id,
      network: campaign.network,
      metadata: {
        purpose: 'CAMPAIGN_DONATION',
        campaign_id,
        campaign_network: campaign.network,
        donor_user_id: user.id,
        donor_wallet_address: wallet.wallet_address,
        amount_xrp: xrpAmount,
        drops,
        finish_after: finishAfter,
        donor_message: donor_message ?? null,
        is_anonymous: is_anonymous ?? false,
      },
    })

    // ── Create pending donation row ───────────────────────────
    const { data: donationRow, error: donErr } = await svc
      .from('campaign_donations')
      .insert({
        campaign_id,
        donor_user_id: user.id,
        donor_wallet_address: wallet.wallet_address,
        amount: xrpAmount,
        currency: campaign.currency ?? 'XRP',
        xaman_payload_uuid: xamanData.uuid,
        escrow_status: 'pending',
        donor_message: donor_message ?? null,
        is_anonymous: is_anonymous ?? false,
      })
      .select('id')
      .single()

    if (donErr) {
      console.error('Failed to create donation row:', donErr)
      throw donErr
    }

    return new Response(JSON.stringify({
      success: true,
      xaman_uuid: xamanData.uuid,
      qr_code: xamanData.refs?.qr_png,
      deep_link: xamanData.next?.always,
      websocket_url: xamanData.refs?.websocket_status,
      donation_id: donationRow.id,
      amount_xrp: xrpAmount,
      recipient: campaign.recipient_wallet_address,
      release_date: campaign.release_date,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in campaign-donate:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
