// Classify a validated XRPL websocket transaction message into a
// user-facing wallet notification (or null if not noteworthy for `address`).

import {
  WalletNotification,
  NotificationKind,
  decodeCurrency,
} from './walletNotifications';

type Network = 'mainnet' | 'testnet';

function fmtAmount(n: number): string {
  if (!isFinite(n)) return String(n);
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function shortAddr(a?: string | null): string {
  if (!a) return 'unknown';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

interface AmountInfo {
  value: number;
  currency: string;
  isXRP: boolean;
}

function parseAmount(a: unknown): AmountInfo | null {
  if (!a) return null;
  if (typeof a === 'string') {
    const n = Number(a) / 1_000_000;
    if (!isFinite(n)) return null;
    return { value: n, currency: 'XRP', isXRP: true };
  }
  if (typeof a === 'object') {
    const obj = a as { value?: string; currency?: string };
    if (obj.value && obj.currency) {
      return {
        value: Number(obj.value),
        currency: decodeCurrency(obj.currency),
        isXRP: false,
      };
    }
  }
  return null;
}

export interface ClassifyInput {
  tx: any; // raw XRPL transaction node (tx or tx_json)
  meta?: any;
  address: string;
  network: Network;
}

type Classified = Omit<WalletNotification, 'id' | 'created_at' | 'read'>;

export function classifyTx({ tx, meta, address, network }: ClassifyInput): Classified | null {
  if (!tx || !tx.TransactionType) return null;
  const txHash: string | null = tx.hash || tx.Hash || null;
  const type = tx.TransactionType as string;
  const result = meta?.TransactionResult;
  if (result && result !== 'tesSUCCESS') return null;

  const base = {
    network,
    wallet_address: address,
    tx_hash: txHash,
  };

  // Payments
  if (type === 'Payment') {
    const delivered = parseAmount(meta?.delivered_amount) || parseAmount(tx.Amount);
    if (!delivered) return null;
    const isIncoming = tx.Destination === address && tx.Account !== address;
    const isOutgoing = tx.Account === address && tx.Destination !== address;

    if (isIncoming) {
      const kind: NotificationKind = delivered.isXRP ? 'xrp_received' : 'token_received';
      return {
        ...base,
        kind,
        title: `Received ${fmtAmount(delivered.value)} ${delivered.currency}`,
        body: `From ${shortAddr(tx.Account)}`,
        amount: delivered.value,
        currency: delivered.currency,
        counterparty: tx.Account || null,
      };
    }
    if (isOutgoing) {
      return {
        ...base,
        kind: 'payment_sent',
        title: `Sent ${fmtAmount(delivered.value)} ${delivered.currency}`,
        body: `To ${shortAddr(tx.Destination)}`,
        amount: delivered.value,
        currency: delivered.currency,
        counterparty: tx.Destination || null,
      };
    }
    return null;
  }

  // Escrow finished - funds delivered to Destination
  if (type === 'EscrowFinish') {
    if (tx.Destination !== address) return null;
    const delivered = parseAmount(meta?.delivered_amount);
    const amount = delivered?.value;
    const currency = delivered?.currency || 'XRP';
    return {
      ...base,
      kind: 'escrow_released',
      title: amount
        ? `Escrow released: ${fmtAmount(amount)} ${currency}`
        : `Escrow released to your wallet`,
      body: `From ${shortAddr(tx.Owner || tx.Account)}`,
      amount,
      currency,
      counterparty: tx.Owner || tx.Account || null,
    };
  }

  // Escrow cancelled - owner gets funds back
  if (type === 'EscrowCancel') {
    if (tx.Owner !== address && tx.Account !== address) return null;
    return {
      ...base,
      kind: 'escrow_refunded',
      title: `Escrow refunded`,
      body: `Funds returned to your wallet`,
      counterparty: tx.Owner || tx.Account || null,
    };
  }

  // Incoming escrow created against you
  if (type === 'EscrowCreate') {
    if (tx.Destination !== address || tx.Account === address) return null;
    const amt = parseAmount(tx.Amount);
    return {
      ...base,
      kind: 'escrow_incoming',
      title: amt
        ? `Incoming escrow: ${fmtAmount(amt.value)} ${amt.currency}`
        : `Incoming escrow`,
      body: `From ${shortAddr(tx.Account)} - pending release`,
      amount: amt?.value,
      currency: amt?.currency,
      counterparty: tx.Account || null,
    };
  }

  return null;
}
