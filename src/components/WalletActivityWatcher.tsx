// Globally subscribes to the active wallet's XRPL activity and emits
// user-facing notifications. Mounted once in <App />.

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useXRPLSubscription, XRPLTransactionEvent } from '@/hooks/useXRPLSubscription';
import { classifyTx } from '@/lib/txClassifier';
import {
  addNotification,
  explorerUrl,
  listNotifications,
} from '@/lib/walletNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';


type Network = 'mainnet' | 'testnet';

interface ParsedTx {
  hash?: string;
  type?: string;
  direction?: 'sent' | 'received';
  delivered_amount?: number | null;
  delivered_currency?: string | null;
  amount?: number;
  currency?: string;
  sender?: string | null;
  destination?: string | null;
  date?: string | null;
  result?: string | null;
}

type DonationMap = Map<string, {
  role: 'donor' | 'recipient';
  stage: 'escrow_create' | 'escrow_finish';
  amount: number;
  currency: string;
  campaign_title: string | null;
  counterparty: string | null;
}>;

async function fetchDonationLookup(address: string): Promise<DonationMap> {
  const map: DonationMap = new Map();
  try {
    const [donorRes, recipRes] = await Promise.all([
      supabase
        .from('campaign_donations')
        .select('amount, currency, escrow_tx_hash, escrow_finish_tx_hash, donor_wallet_address, campaigns:campaign_id(title, recipient_wallet_address)')
        .eq('donor_wallet_address', address),
      supabase
        .from('campaign_donations')
        .select('amount, currency, escrow_tx_hash, escrow_finish_tx_hash, donor_wallet_address, campaigns:campaign_id!inner(title, recipient_wallet_address)')
        .in('escrow_status', ['escrowed', 'released'])
        .eq('campaigns.recipient_wallet_address', address),
    ]);
    const rows = [
      ...((donorRes.data || []) as any[]).map((r) => ({ r, role: 'donor' as const })),
      ...((recipRes.data || []) as any[]).map((r) => ({ r, role: 'recipient' as const })),
    ];
    for (const { r, role } of rows) {
      const campaign = r.campaigns || {};
      const base = {
        role,
        amount: Number(r.amount ?? 0),
        currency: r.currency ?? 'XRP',
        campaign_title: campaign.title ?? null,
        counterparty: role === 'donor' ? campaign.recipient_wallet_address ?? null : r.donor_wallet_address ?? null,
      };
      if (r.escrow_tx_hash) map.set(r.escrow_tx_hash, { ...base, stage: 'escrow_create' });
      if (r.escrow_finish_tx_hash) map.set(r.escrow_finish_tx_hash, { ...base, stage: 'escrow_finish' });
    }
  } catch { /* non-blocking */ }
  return map;
}

function donationNotification(
  hash: string,
  d: { role: 'donor' | 'recipient'; stage: 'escrow_create' | 'escrow_finish'; amount: number; currency: string; campaign_title: string | null; counterparty: string | null },
  address: string,
  network: Network,
) {
  const amt = `${fmt(d.amount)} ${d.currency}`;
  const campaign = d.campaign_title ? ` to "${d.campaign_title}"` : '';
  const fromCampaign = d.campaign_title ? ` for "${d.campaign_title}"` : '';
  const base = { network, wallet_address: address, tx_hash: hash };
  if (d.role === 'donor' && d.stage === 'escrow_create') {
    return { ...base, kind: 'donation_sent' as const, title: `You donated ${amt}${campaign}`, body: `Funds locked in escrow until release date.`, amount: d.amount, currency: d.currency, counterparty: d.counterparty };
  }
  if (d.role === 'donor' && d.stage === 'escrow_finish') {
    return { ...base, kind: 'donation_delivered' as const, title: `Your donation was delivered`, body: `${amt}${fromCampaign} was released to the recipient.`, amount: d.amount, currency: d.currency, counterparty: d.counterparty };
  }
  if (d.role === 'recipient' && d.stage === 'escrow_create') {
    return { ...base, kind: 'donation_pledged' as const, title: `Donation pledged: ${amt}`, body: `Someone pledged ${amt}${fromCampaign}. Funds will release on the scheduled date.`, amount: d.amount, currency: d.currency, counterparty: d.counterparty };
  }
  return { ...base, kind: 'donation_received' as const, title: `Funds donated to you: ${amt}`, body: `Released${fromCampaign} from ${short(d.counterparty)}.`, amount: d.amount, currency: d.currency, counterparty: d.counterparty };
}

async function backfill(
  address: string,
  network: Network,
  fetchPortfolio: () => Promise<any>,
) {
  try {
    const [data, donations] = await Promise.all([
      fetchPortfolio().catch(() => null),
      fetchDonationLookup(address),
    ]);
    if (!data?.transactions) return;
    const existing = new Set(listNotifications(address, network).map(n => n.tx_hash));
    const txs: ParsedTx[] = data.transactions;
    for (const t of [...txs].reverse()) {
      if (!t.hash || existing.has(t.hash)) continue;
      if (t.result && t.result !== 'tesSUCCESS') continue;
      const donation = donations.get(t.hash);
      const note = donation
        ? donationNotification(t.hash, donation, address, network)
        : parsedToNotification(t, address, network);
      if (!note) continue;
      addNotification({ ...note, backfilled: true, created_at: t.date || undefined });
    }
  } catch {
    /* non-blocking */
  }
}


function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}
function short(a?: string | null) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'unknown';
}

function parsedToNotification(t: ParsedTx, address: string, network: Network) {
  const amount = t.delivered_amount ?? t.amount;
  const currency = t.delivered_currency ?? t.currency ?? 'XRP';
  const base = { network, wallet_address: address, tx_hash: t.hash || null };

  if (t.type === 'Payment') {
    if (t.direction === 'received' && t.sender !== address) {
      const isXrp = currency === 'XRP';
      return {
        ...base,
        kind: isXrp ? ('xrp_received' as const) : ('token_received' as const),
        title: amount ? `Received ${fmt(amount)} ${currency}` : `Received ${currency}`,
        body: `From ${short(t.sender)}`,
        amount: amount ?? undefined,
        currency,
        counterparty: t.sender ?? null,
      };
    }
    if (t.direction === 'sent' && t.destination !== address) {
      return {
        ...base,
        kind: 'payment_sent' as const,
        title: amount ? `Sent ${fmt(amount)} ${currency}` : `Sent ${currency}`,
        body: `To ${short(t.destination)}`,
        amount: amount ?? undefined,
        currency,
        counterparty: t.destination ?? null,
      };
    }
    return null;
  }

  if (t.type === 'EscrowFinish' && t.destination === address) {
    return {
      ...base,
      kind: 'escrow_released' as const,
      title: amount ? `Escrow released: ${fmt(amount)} ${currency}` : `Escrow released`,
      body: `From ${short(t.sender)}`,
      amount: amount ?? undefined,
      currency,
      counterparty: t.sender ?? null,
    };
  }

  if (t.type === 'EscrowCreate' && t.destination === address && t.sender !== address) {
    return {
      ...base,
      kind: 'escrow_incoming' as const,
      title: amount ? `Incoming escrow: ${fmt(amount)} ${currency}` : `Incoming escrow`,
      body: `From ${short(t.sender)} - pending release`,
      amount: amount ?? undefined,
      currency,
      counterparty: t.sender ?? null,
    };
  }

  return null;
}

export function WalletActivityWatcher() {
  const { activeAddress, activeNetwork } = useActiveWallet();
  const { user } = useAuth();
  const network: Network = activeNetwork === 'testnet' ? 'testnet' : 'mainnet';
  const lastBackfillKey = useRef<string>('');

  // Run a backfill whenever the active wallet (or network) changes.
  useEffect(() => {
    if (!activeAddress || !user) return;
    const key = `${network}:${activeAddress}`;
    if (lastBackfillKey.current === key) return;
    lastBackfillKey.current = key;
    backfill(activeAddress, network);
  }, [activeAddress, network, user]);


  const handleTx = (evt: XRPLTransactionEvent) => {
    if (!activeAddress) return;
    const note = classifyTx({
      tx: evt.tx,
      meta: evt.meta,
      address: activeAddress,
      network,
    });
    if (!note) return;
    const inserted = addNotification(note);
    if (!inserted) return;
    // Live toast (skip ephemeral toast for outgoing? -> keep, plan says quiet success)
    if (inserted.kind === 'payment_sent') {
      toast.success(inserted.title, { description: inserted.body });
      return;
    }
    toast(inserted.title, {
      description: inserted.body,
      action: inserted.tx_hash
        ? {
            label: 'View',
            onClick: () =>
              window.open(explorerUrl(network, inserted.tx_hash as string), '_blank'),
          }
        : undefined,
    });
  };

  useXRPLSubscription(activeAddress, network, handleTx);

  return null;
}
