// Lightweight wallet-activity notification store backed by localStorage,
// scoped per (wallet_address, network). Emits a 'change' event that React
// components subscribe to via useSyncExternalStore.

export type NotificationKind =
  | 'xrp_received'
  | 'token_received'
  | 'escrow_released'
  | 'escrow_refunded'
  | 'escrow_incoming'
  | 'payment_sent';

export interface WalletNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  amount?: number;
  currency?: string;
  counterparty?: string | null;
  tx_hash?: string | null;
  network: 'mainnet' | 'testnet';
  wallet_address: string;
  created_at: string; // ISO
  read: boolean;
  backfilled?: boolean;
}

const MAX_PER_SCOPE = 200;
const EVENT = 'wallet-notifications:change';

function key(address: string, network: string) {
  return `accountabul_notifications_${network}_${address}`;
}

function readAll(address: string, network: string): WalletNotification[] {
  try {
    const raw = localStorage.getItem(key(address, network));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(address: string, network: string, list: WalletNotification[]) {
  try {
    localStorage.setItem(key(address, network), JSON.stringify(list.slice(0, MAX_PER_SCOPE)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // ignore quota errors
  }
}

export function listNotifications(address: string | null, network: string): WalletNotification[] {
  if (!address) return [];
  return readAll(address, network);
}

export function unreadCount(address: string | null, network: string): number {
  if (!address) return 0;
  return readAll(address, network).filter(n => !n.read).length;
}

/**
 * Adds a notification. Skips if a notification with the same tx_hash+kind
 * already exists in the scope (idempotent backfill-safe).
 * Returns the inserted notification, or null if it was a dedupe.
 */
export function addNotification(
  n: Omit<WalletNotification, 'id' | 'created_at' | 'read'> & {
    id?: string;
    created_at?: string;
    read?: boolean;
  }
): WalletNotification | null {
  const current = readAll(n.wallet_address, n.network);
  if (n.tx_hash) {
    const exists = current.some(x => x.tx_hash === n.tx_hash && x.kind === n.kind);
    if (exists) return null;
  }
  const entry: WalletNotification = {
    id: n.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: n.created_at ?? new Date().toISOString(),
    read: n.read ?? false,
    ...n,
  };
  const next = [entry, ...current].slice(0, MAX_PER_SCOPE);
  writeAll(n.wallet_address, n.network, next);
  return entry;
}

export function markAllRead(address: string | null, network: string) {
  if (!address) return;
  const list = readAll(address, network).map(n => ({ ...n, read: true }));
  writeAll(address, network, list);
}

export function markRead(address: string, network: string, id: string) {
  const list = readAll(address, network).map(n =>
    n.id === id ? { ...n, read: true } : n
  );
  writeAll(address, network, list);
}

export function clearAll(address: string, network: string) {
  writeAll(address, network, []);
}

export function subscribe(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function explorerUrl(network: 'mainnet' | 'testnet', txHash: string): string {
  return network === 'testnet'
    ? `https://testnet.xrpl.org/transactions/${txHash}`
    : `https://livenet.xrpl.org/transactions/${txHash}`;
}

/** Hex currency → ASCII helper (40-char hex = standard currency code). */
export function decodeCurrency(code: string): string {
  if (!code) return code;
  if (code.length === 3) return code;
  if (code.length === 40) {
    try {
      const bytes = code.match(/../g) || [];
      const ascii = bytes
        .map(h => String.fromCharCode(parseInt(h, 16)))
        .join('')
        .replace(/\0+$/g, '')
        .trim();
      return ascii || code;
    } catch {
      return code;
    }
  }
  return code;
}
