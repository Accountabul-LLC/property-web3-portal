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

// XRPL epoch starts Jan 1, 2000 — Unix epoch offset in seconds
const RIPPLE_EPOCH_OFFSET = 946684800
const XRPL_NODES: Record<'mainnet' | 'testnet' | 'devnet', string[]> = {
  mainnet: ['https://xrplcluster.com', 'https://s1.ripple.com:51234', 'https://s2.ripple.com:51234'],
  testnet: ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'],
  devnet: ['https://s.devnet.rippletest.net:51234'],
}

// RLUSD = "RLUSD" padded to 40-hex characters per XRPL IOU currency code spec.
const RLUSD_CURRENCY_HEX = '524C555344000000000000000000000000000000'
const RLUSD_ISSUER: Record<'mainnet' | 'testnet' | 'devnet', string | null> = {
  mainnet: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
  testnet: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV',
  devnet: null,
}

function toDrops(xrp: number): string {
  return String(Math.round(xrp * 1_000_000))
}

function toXrplTime(isoDate: string): number {
  const unixSeconds = Math.floor(new Date(isoDate).getTime() / 1000)
  return unixSeconds - RIPPLE_EPOCH_OFFSET
}

async function xrplRpc(network: 'mainnet' | 'testnet' | 'devnet', method: string, params: Record<string, unknown>[]) {
  const nodes = XRPL_NODES[network] ?? XRPL_NODES.mainnet
  let lastError: Error | null = null
  for (const node of nodes) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, params }),
        signal: AbortSignal.timeout(7000),
      })
      if (!res.ok) {
        lastError = new Error(`${node} returned ${res.status}`)
        continue
      }
      return await res.json()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastError ?? new Error(`Unable to query XRPL ${method}`)
}

function isDepositAuthEnabled(accountData: Record<string, unknown> | null | undefined): boolean {
  const flags = Number(accountData?.Flags ?? 0)
  return (flags & 0x01000000) !== 0
}

async function preflightRecipient(
  recipientAddress: string,
  donorAddress: string,
  network: 'mainnet' | 'testnet' | 'devnet',
  requireDepositAuthCheck: boolean,
) {
  const accountInfo = await xrplRpc(network, 'account_info', [{ account: recipientAddress, ledger_index: 'validated' }])
  const accountData = accountInfo?.result?.account_data
  if (!accountData) {
    return { ok: false as const, error: 'This campaign recipient wallet is not activated on the XRP Ledger yet.' }
  }

  if (!requireDepositAuthCheck) {
    return { ok: true as const, accountData }
  }

  const depositAuth = accountInfo?.result?.account_flags?.depositAuth ?? isDepositAuthEnabled(accountData)
  if (depositAuth) {
    const authRes = await xrplRpc(network, 'deposit_authorized', [{
      source_account: donorAddress,
      destination_account: recipientAddress,
      ledger_index: 'validated',
    }])

    const authorized = authRes?.result?.authorized === true
    if (!authorized) {
      return {
        ok: false as const,
        error: 'This recipient requires deposit authorization. Please contact the campaign owner to preauthorize your wallet.',
      }
    }
  }

  return { ok: true as const, accountData }
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
    const requestedCurrency = String(body?.currency ?? 'XRP').toUpperCase().trim()

    if (!campaign_id || !amount) {
      return new Response(JSON.stringify({ error: 'Missing campaign_id or amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!['XRP', 'RLUSD'].includes(requestedCurrency)) {
      return new Response(JSON.stringify({ error: `Unsupported currency: ${requestedCurrency}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const donationAmount = parseFloat(amount)
    if (isNaN(donationAmount) || donationAmount < 1) {
      return new Response(JSON.stringify({ error: `Minimum donation is 1 ${requestedCurrency}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch campaign ────────────────────────────────────────
    const { data: campaign, error: campaignErr } = await svc
      .from('campaigns')
      .select('id, title, slug, status, campaign_type, network, recipient_wallet_address, release_date, currency, accepted_assets')
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
    if (campaign.campaign_type !== 'direct' && (!campaign.release_date || new Date(campaign.release_date) <= new Date())) {
      return new Response(JSON.stringify({ error: 'Campaign release date has already passed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Accepted-assets whitelist ─────────────────────────────
    const acceptedAssets: string[] = Array.isArray(campaign.accepted_assets) && campaign.accepted_assets.length > 0
      ? campaign.accepted_assets.map((a: string) => String(a).toUpperCase())
      : ['XRP']
    if (!acceptedAssets.includes(requestedCurrency)) {
      return new Response(JSON.stringify({
        error: `This cause only accepts ${acceptedAssets.join(' or ')}. ${requestedCurrency} donations were not enabled by the organizer.`,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // XRPL EscrowCreate only supports XRP. IOU donations (RLUSD) must be direct payments.
    const isRlusd = requestedCurrency === 'RLUSD'
    if (isRlusd && campaign.campaign_type !== 'direct') {
      return new Response(JSON.stringify({
        error: 'RLUSD donations are only available on direct (evergreen) campaigns — the XRP Ledger escrow type only supports XRP.',
      }), {
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

    const recipientNetwork = (campaign.network === 'testnet' || campaign.network === 'devnet' || campaign.network === 'mainnet')
      ? campaign.network
      : 'mainnet'
    const recipientPreflight = await preflightRecipient(
      campaign.recipient_wallet_address,
      wallet.wallet_address,
      recipientNetwork,
      campaign.campaign_type === 'direct',
    )

    if (!recipientPreflight.ok) {
      await logAppAudit(svc, {
        area: 'causes',
        action: 'donation_preflight_blocked',
        entityType: 'campaign',
        entityId: campaign.id,
        actorId: user.id,
        metadata: {
          origin: 'campaign-donate',
          campaign_type: campaign.campaign_type ?? 'escrow',
          recipient_wallet_address: campaign.recipient_wallet_address,
          reason: recipientPreflight.error,
        },
      })

      return new Response(JSON.stringify({ error: recipientPreflight.error }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isDirectCampaign = campaign.campaign_type === 'direct'
    const finishAfter = isDirectCampaign || !campaign.release_date ? null : toXrplTime(campaign.release_date)

    // Build the txjson depending on requested currency.
    let txjson: Record<string, unknown>
    let amountLogLabel: string

    if (isRlusd) {
      const rlusdIssuer = RLUSD_ISSUER[recipientNetwork]
      if (!rlusdIssuer) {
        return new Response(JSON.stringify({ error: `RLUSD is not available on ${recipientNetwork}.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Recipient must have an RLUSD trustline; otherwise the payment will fail.
      const linesRes = await xrplRpc(recipientNetwork, 'account_lines', [{
        account: campaign.recipient_wallet_address,
        peer: rlusdIssuer,
        ledger_index: 'validated',
      }])
      const recipientHasTrustline = Array.isArray(linesRes?.result?.lines)
        && linesRes.result.lines.some((l: { currency?: string }) => l?.currency === RLUSD_CURRENCY_HEX || l?.currency === 'RLUSD')
      if (!recipientHasTrustline) {
        return new Response(JSON.stringify({
          error: "Recipient hasn't set up an RLUSD trustline yet — ask them to add one, or donate in XRP instead.",
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Donor must hold enough RLUSD on a trustline to the same issuer.
      const donorLinesRes = await xrplRpc(recipientNetwork, 'account_lines', [{
        account: wallet.wallet_address,
        peer: rlusdIssuer,
        ledger_index: 'validated',
      }])
      const donorLine = Array.isArray(donorLinesRes?.result?.lines)
        ? donorLinesRes.result.lines.find((l: { currency?: string }) => l?.currency === RLUSD_CURRENCY_HEX || l?.currency === 'RLUSD')
        : null
      const donorBalance = donorLine ? parseFloat(donorLine.balance ?? '0') : 0
      if (!donorLine || donorBalance < donationAmount) {
        return new Response(JSON.stringify({
          error: donorLine
            ? `Insufficient RLUSD balance — you have ${donorBalance} RLUSD, this donation needs ${donationAmount}.`
            : "Your wallet doesn't have an RLUSD trustline. Add one in Xaman, then try again.",
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      txjson = {
        TransactionType: 'Payment',
        Account: wallet.wallet_address,
        Destination: campaign.recipient_wallet_address,
        Amount: {
          currency: RLUSD_CURRENCY_HEX,
          issuer: rlusdIssuer,
          value: String(donationAmount),
        },
      }
      amountLogLabel = `${donationAmount} RLUSD`
    } else {
      // XRP path (escrow or direct).
      const drops = toDrops(donationAmount)
      txjson = isDirectCampaign
        ? {
            TransactionType: 'Payment',
            Account: wallet.wallet_address,
            Amount: drops,
            Destination: campaign.recipient_wallet_address,
          }
        : {
            TransactionType: 'EscrowCreate',
            Account: wallet.wallet_address,
            Amount: drops,
            Destination: campaign.recipient_wallet_address,
            FinishAfter: finishAfter,
          }
      amountLogLabel = `${donationAmount} XRP (${drops} drops)`
    }

    console.log(
      `Building ${(txjson as { TransactionType: string }).TransactionType}: ${wallet.wallet_address} → ${campaign.recipient_wallet_address} | ${amountLogLabel}${finishAfter ? ` | FinishAfter: ${finishAfter}` : ''}`,
    )

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
          purpose: `${isDirectCampaign ? 'CAMPAIGN_DONATION_DIRECT' : 'CAMPAIGN_DONATION_ESCROW'}${isRlusd ? '_RLUSD' : ''}`,
          campaign_id,
          campaign_title: campaign.title,
          amount: donationAmount,
          currency: requestedCurrency,
          campaign_type: campaign.campaign_type ?? 'escrow',
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
    const { error: payloadInsertErr } = await svc.from('xaman_payloads').insert({
      uuid: xamanData.uuid,
      status: 'pending',
      wallet_address: wallet.wallet_address,
      network: campaign.network,
      metadata: {
        purpose: `${isDirectCampaign ? 'CAMPAIGN_DONATION_DIRECT' : 'CAMPAIGN_DONATION_ESCROW'}${isRlusd ? '_RLUSD' : ''}`,
        campaign_id,
        campaign_network: campaign.network,
        intended_user_id: user.id,
        donor_user_id: user.id,
        donor_wallet_address: wallet.wallet_address,
        amount: donationAmount,
        currency: requestedCurrency,
        finish_after: finishAfter,
        donor_message: donor_message ?? null,
        is_anonymous: is_anonymous ?? false,
        campaign_type: campaign.campaign_type ?? 'escrow',
      },
    })
    if (payloadInsertErr) {
      console.error('Failed to insert xaman_payloads row:', payloadInsertErr)
      throw payloadInsertErr
    }

    // ── Look up donor display name from profile ───────────────
    const { data: profile } = await svc
      .from('profiles')
      .select('full_name, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle()

    let donorDisplayName: string | null = null
    if (profile) {
      if (profile.full_name && profile.full_name.trim()) {
        donorDisplayName = profile.full_name.trim()
      } else if (profile.first_name && profile.first_name.trim()) {
        const last = profile.last_name?.trim()
        donorDisplayName = last
          ? `${profile.first_name.trim()} ${last.charAt(0)}.`
          : profile.first_name.trim()
      }
    }

    // ── Create pending donation row ───────────────────────────
    const { data: donationRow, error: donErr } = await svc
      .from('campaign_donations')
      .insert({
        campaign_id,
        donor_user_id: user.id,
        donor_wallet_address: wallet.wallet_address,
        donor_display_name: donorDisplayName,
        amount: donationAmount,
        currency: requestedCurrency,
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

    await logAppAudit(svc, {
      area: 'causes',
      action: 'donation_initiated',
      entityType: 'campaign_donation',
      entityId: donationRow.id,
      actorId: user.id,
      afterState: {
        campaign_id,
        donor_wallet_address: wallet.wallet_address,
        amount: donationAmount,
        currency: requestedCurrency,
        status: 'pending',
      },
      metadata: {
        origin: 'campaign-donate',
        xaman_uuid: xamanData.uuid,
        network: campaign.network,
      },
    })

    return new Response(JSON.stringify({
      success: true,
      xaman_uuid: xamanData.uuid,
      qr_code: xamanData.refs?.qr_png,
      deep_link: xamanData.next?.always,
      websocket_url: xamanData.refs?.websocket_status,
      donation_id: donationRow.id,
      amount: donationAmount,
      currency: requestedCurrency,
      recipient: campaign.recipient_wallet_address,
      release_date: campaign.release_date,
      campaign_type: campaign.campaign_type ?? 'escrow',
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
