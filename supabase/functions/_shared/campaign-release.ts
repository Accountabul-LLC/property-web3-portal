/* eslint-disable @typescript-eslint/no-explicit-any */

import { Client, Wallet } from 'npm:xrpl@3.1.0'

const XRPL_NODES: Record<string, string[]> = {
  mainnet: ['https://xrplcluster.com', 'https://s1.ripple.com'],
  testnet: ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'],
  devnet: ['https://s.devnet.rippletest.net:51234'],
}

export type CampaignReleaseCampaign = {
  id: string
  title: string
  status: string
  release_date: string
  recipient_wallet_address: string
  network?: string | null
}

export type CampaignReleaseDonation = {
  id: string
  donor_wallet_address: string
  escrow_sequence: number | null
  xaman_payload_uuid: string | null
}

export type CampaignReleaseResult =
  | { donation_id: string; status: 'released'; tx_hash: string; engine_result: string }
  | { donation_id: string; status: 'pending_manual'; finish_tx: Record<string, unknown>; message: string }
  | { donation_id: string; status: 'skipped'; reason: string }
  | { donation_id: string; status: 'error'; error: string }

export type CampaignReleaseSummary = {
  released_count: number
  manual_count: number
  error_count: number
  total_donations: number
  campaign_completed: boolean
  results: CampaignReleaseResult[]
}

function resolveNetwork(network: string | null | undefined): keyof typeof XRPL_NODES {
  if (network === 'testnet' || network === 'devnet' || network === 'mainnet') return network
  return 'mainnet'
}

async function connectClient(network: keyof typeof XRPL_NODES): Promise<{ client: Client; node: string }> {
  const nodes = XRPL_NODES[network] ?? XRPL_NODES.mainnet
  let lastError: Error | null = null
  for (const node of nodes) {
    const client = new Client(node)
    try {
      await client.connect()
      return { client, node }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      try { await client.disconnect() } catch (disconnectErr) { void disconnectErr }
    }
  }
  throw lastError ?? new Error(`Unable to connect to XRPL ${network}`)
}

export async function releaseCampaignEscrows(opts: {
  svc: any
  campaign: CampaignReleaseCampaign
  signerSeed?: string | null
  allowManualFallback?: boolean
}): Promise<CampaignReleaseSummary> {
  const { svc, campaign, signerSeed = null, allowManualFallback = true } = opts

  const { data: donations, error: donationError } = await svc
    .from('campaign_donations')
    .select('id, donor_wallet_address, escrow_sequence, xaman_payload_uuid')
    .eq('campaign_id', campaign.id)
    .eq('escrow_status', 'escrowed')
    .order('created_at', { ascending: true })

  if (donationError) throw donationError

  const rows: CampaignReleaseDonation[] = donations ?? []
  if (rows.length === 0) {
    return {
      released_count: 0,
      manual_count: 0,
      error_count: 0,
      total_donations: 0,
      campaign_completed: false,
      results: [],
    }
  }

  const results: CampaignReleaseResult[] = []
  const signerWallet = signerSeed ? Wallet.fromSeed(signerSeed) : null

  for (const donation of rows) {
    if (!donation.escrow_sequence) {
      results.push({ donation_id: donation.id, status: 'skipped', reason: 'missing escrow_sequence' })
      continue
    }

    const { data: payloadRow } = await svc
      .from('xaman_payloads')
      .select('network')
      .eq('uuid', donation.xaman_payload_uuid)
      .maybeSingle()

    const network = resolveNetwork(payloadRow?.network ?? campaign.network)
    const finishTx: Record<string, unknown> = {
      TransactionType: 'EscrowFinish',
      Account: signerWallet?.address ?? campaign.recipient_wallet_address,
      Owner: donation.donor_wallet_address,
      OfferSequence: donation.escrow_sequence,
    }

    if (!signerWallet) {
      if (allowManualFallback) {
        results.push({
          donation_id: donation.id,
          status: 'pending_manual',
          finish_tx: finishTx,
          message: 'Sign this EscrowFinish tx with the recipient wallet in Xaman',
        })
        continue
      }

      results.push({
        donation_id: donation.id,
        status: 'error',
        error: 'Campaign release signer seed is not configured',
      })
      continue
    }

    let client: Client | null = null
    try {
      const connection = await connectClient(network)
      client = connection.client

      const prepared = await client.autofill({
        ...finishTx,
        Fee: '12',
      } as any)

      const signed = signerWallet.sign(prepared)
      const submitted = await client.submitAndWait(signed.tx_blob)
      const txResult = (submitted as any)?.result?.meta?.TransactionResult ?? (submitted as any)?.meta?.TransactionResult ?? 'unknown'
      const txHash = (submitted as any)?.result?.tx_json?.hash ?? signed.hash

      if (txResult !== 'tesSUCCESS') {
        throw new Error(`EscrowFinish failed: ${txResult}`)
      }

      const now = new Date().toISOString()
      await svc
        .from('campaign_donations')
        .update({
          escrow_status: 'released',
          escrow_finish_tx_hash: txHash,
          updated_at: now,
        })
        .eq('id', donation.id)

      results.push({
        donation_id: donation.id,
        status: 'released',
        tx_hash: txHash,
        engine_result: txResult,
      })
    } catch (err) {
      results.push({
        donation_id: donation.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      try { await client?.disconnect() } catch (disconnectErr) { void disconnectErr }
    }
  }

  const releasedCount = results.filter((r): r is Extract<CampaignReleaseResult, { status: 'released' }> => r.status === 'released').length
  const manualCount = results.filter((r): r is Extract<CampaignReleaseResult, { status: 'pending_manual' }> => r.status === 'pending_manual').length
  const errorCount = results.filter((r): r is Extract<CampaignReleaseResult, { status: 'error' }> => r.status === 'error').length
  const allReleased = releasedCount > 0 && releasedCount === rows.length

  if (allReleased) {
    await svc
      .from('campaigns')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', campaign.id)
  }

  return {
    released_count: releasedCount,
    manual_count: manualCount,
    error_count: errorCount,
    total_donations: rows.length,
    campaign_completed: allReleased,
    results,
  }
}
