/**
 * campaign-release  (admin only)
 *
 * Triggers EscrowFinish for all escrowed donations on a campaign whose
 * release_date has passed. Funds go directly from escrow to recipient wallet.
 *
 * For testnet: auto-signs EscrowFinish using the platform signing wallet if
 *   configured (CAMPAIGN_RELEASE_SIGNER_SEED). Falls back to building the
 *   tx JSON for manual submission if no signer is configured.
 *
 * For mainnet: builds EscrowFinish tx JSON and sends to admin's Xaman for signing.
 *
 * Body: { campaign_id }
 * Returns: { released_count, results[] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const XRPL_NODES = {
  mainnet: ['https://xrplcluster.com', 'https://s1.ripple.com'],
  testnet: ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'],
  devnet:  ['https://s.devnet.rippletest.net:51234'],
}

async function xrplRequest(network: string, method: string, params: unknown[]): Promise<any> {
  const nodes = XRPL_NODES[network as keyof typeof XRPL_NODES] ?? XRPL_NODES.mainnet
  let lastErr: Error | null = null
  for (const node of nodes) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, params }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) { lastErr = new Error(`${node} HTTP ${res.status}`); continue }
      const data = await res.json()
      return data.result
    } catch (e) {
      lastErr = e as Error
    }
  }
  throw lastErr ?? new Error('All XRPL nodes failed')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // ── Auth + admin check ────────────────────────────────────
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

    const { data: isAdmin } = await svc.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: isCompliance } = await svc.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
    if (!isAdmin && !isCompliance) {
      return new Response(JSON.stringify({ error: 'Forbidden: requires admin or compliance_officer role' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Validate campaign ─────────────────────────────────────
    const { campaign_id } = await req.json()
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'Missing campaign_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: campaign } = await svc
      .from('campaigns')
      .select('id, title, status, release_date, recipient_wallet_address, network')
      .eq('id', campaign_id)
      .maybeSingle() as any

    if (!campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (campaign.status !== 'active') {
      return new Response(JSON.stringify({ error: `Campaign is not active (status: ${campaign.status})` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (new Date(campaign.release_date) > new Date()) {
      return new Response(JSON.stringify({ error: 'Campaign release date has not passed yet' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch all escrowed donations ──────────────────────────
    const { data: donations } = await svc
      .from('campaign_donations')
      .select('id, donor_wallet_address, amount, escrow_tx_hash, escrow_sequence')
      .eq('campaign_id', campaign_id)
      .eq('escrow_status', 'escrowed') as any

    if (!donations || donations.length === 0) {
      return new Response(JSON.stringify({
        released_count: 0,
        message: 'No escrowed donations to release',
        results: [],
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Releasing ${donations.length} escrow(s) for campaign: ${campaign.title}`)

    // Optional platform signer for testnet auto-release
    const signerSeed = Deno.env.get('CAMPAIGN_RELEASE_SIGNER_SEED')
    const network: string = campaign.network ?? 'testnet'

    const results: any[] = []

    for (const donation of donations) {
      if (!donation.escrow_sequence) {
        console.warn(`Donation ${donation.id} missing escrow_sequence — skipping auto-release`)
        results.push({ donation_id: donation.id, status: 'skipped', reason: 'missing escrow_sequence' })
        continue
      }

      const finishTx: Record<string, unknown> = {
        TransactionType: 'EscrowFinish',
        Account: campaign.recipient_wallet_address, // recipient finishes the escrow
        Owner: donation.donor_wallet_address,
        OfferSequence: donation.escrow_sequence,
      }

      // Testnet auto-sign path
      if (signerSeed && network !== 'mainnet') {
        try {
          const { Wallet } = await import('npm:xrpl@3.1.0')
          const signerWallet = Wallet.fromSeed(signerSeed)

          // Get account info for sequence
          const accountInfo = await xrplRequest(network, 'account_info', [
            { account: signerWallet.address, ledger_index: 'current' }
          ])
          if (accountInfo?.error) {
            throw new Error(`Account info error: ${accountInfo.error_message ?? accountInfo.error}`)
          }

          const serverInfo = await xrplRequest(network, 'server_info', [{}])
          const ledgerSeq = serverInfo?.info?.validated_ledger?.seq ?? 0

          const completeTx = {
            ...finishTx,
            Account: signerWallet.address,
            Sequence: accountInfo.account_data.Sequence,
            Fee: '12',
            LastLedgerSequence: ledgerSeq + 30,
          }

          const signed = signerWallet.sign(completeTx as any)
          const submit = await xrplRequest(network, 'submit', [{ tx_blob: signed.tx_blob }])

          const txResult = submit?.engine_result ?? 'unknown'
          const txHash = submit?.tx_json?.hash ?? signed.hash

          await svc
            .from('campaign_donations')
            .update({
              escrow_status: 'released',
              escrow_finish_tx_hash: txHash,
              updated_at: new Date().toISOString(),
            })
            .eq('id', donation.id)

          results.push({ donation_id: donation.id, status: 'released', tx_hash: txHash, engine_result: txResult })
          console.log(`Released donation ${donation.id}: ${txResult} tx=${txHash}`)

        } catch (err: any) {
          console.error(`Failed to release donation ${donation.id}:`, err.message)
          results.push({ donation_id: donation.id, status: 'error', error: err.message })
        }

      } else {
        // No auto-signer — return tx JSON for manual/Xaman submission
        results.push({
          donation_id: donation.id,
          status: 'pending_manual',
          finish_tx: finishTx,
          message: 'Sign this EscrowFinish tx with the recipient wallet in Xaman',
        })
      }
    }

    // Mark campaign as completed if all released
    const allReleased = results.every(r => r.status === 'released')
    if (allReleased && results.length > 0) {
      await svc
        .from('campaigns')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', campaign_id) as any
    }

    const releasedCount = results.filter(r => r.status === 'released').length

    return new Response(JSON.stringify({
      released_count: releasedCount,
      total_donations: donations.length,
      campaign_completed: allReleased,
      results,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in campaign-release:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
