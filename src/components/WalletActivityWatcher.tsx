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

async function backfill(address: string, network: Network) {
  try {
    const { data, error } = await supabase.functions.invoke('xrpl-account-data', {
      body: { wallet_address: address, network },
    });
    if (error || !data?.transactions) return;
    const existing = new Set(listNotifications(address, network).map(n => n.tx_hash));
    const txs: ParsedTx[] = data.transactions;
    // Reverse so we insert oldest-first, leaving most recent at top.
    for (const t of [...txs].reverse()) {
      if (!t.hash || existing.has(t.hash)) continue;
      if (t.result && t.result !== 'tesSUCCESS') continue;
      const note = parsedToNotification(t, address, network);
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
      body: `From ${short(t.sender)} — pending release`,
      amount: amount ?? undefined,
      currency,
      counterparty: t.sender ?? null,
    };
  }

  return null;
}

export function WalletActivityWatcher() {
  const { activeAddress, activeNetwork } = useActiveWallet();
  const network: Network = activeNetwork === 'testnet' ? 'testnet' : 'mainnet';
  const lastBackfillKey = useRef<string>('');

  // Run a backfill whenever the active wallet (or network) changes.
  useEffect(() => {
    if (!activeAddress) return;
    const key = `${network}:${activeAddress}`;
    if (lastBackfillKey.current === key) return;
    lastBackfillKey.current = key;
    backfill(activeAddress, network);
  }, [activeAddress, network]);

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
