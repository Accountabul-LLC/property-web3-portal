import { useSyncExternalStore, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ExternalLink, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  listNotifications,
  unreadCount,
  markAllRead,
  markRead,
  subscribe,
  explorerUrl,
  WalletNotification,
} from '@/lib/walletNotifications';
import {
  useServerNotifications,
  markServerNotificationRead,
  markAllServerNotificationsRead,
  ServerNotification,
} from '@/hooks/useServerNotifications';
import { formatDistanceToNow } from 'date-fns';

type UnifiedItem = {
  id: string;
  source: 'server' | 'wallet';
  title: string;
  body: string;
  tx_hash: string | null;
  network: 'mainnet' | 'testnet';
  created_at: string;
  read: boolean;
  backfilled?: boolean;
  wallet_address: string | null;
  donation_id: string | null;
  raw: ServerNotification | WalletNotification;
};

function useWalletNotifications(address: string | null, network: 'mainnet' | 'testnet') {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => `${address ?? ''}:${network}:${unreadCount(address, network)}:${listNotifications(address, network).length}`,
    () => '',
  );
  void snapshot;
  return {
    items: listNotifications(address, network),
    unread: unreadCount(address, network),
  };
}

export function NotificationBell() {
  const { user } = useAuth();
  const { activeAddress, activeNetwork } = useActiveWallet();
  const network: 'mainnet' | 'testnet' = activeNetwork === 'testnet' ? 'testnet' : 'mainnet';
  const { items: walletItems, unread: walletUnread } = useWalletNotifications(activeAddress, network);
  const { notifications: serverItems, unreadCount: serverUnread } = useServerNotifications();

  const merged: UnifiedItem[] = useMemo(() => {
    const fromServer: UnifiedItem[] = serverItems.map((n) => ({
      id: `srv-${n.id}`,
      source: 'server',
      title: n.title,
      body: n.body ?? '',
      tx_hash: n.tx_hash,
      network: (n.network === 'testnet' ? 'testnet' : 'mainnet') as 'mainnet' | 'testnet',
      created_at: n.created_at,
      read: !!n.read_at,
      raw: n,
    }));
    const fromWallet: UnifiedItem[] = walletItems.map((n) => ({
      id: `wal-${n.id}`,
      source: 'wallet',
      title: n.title,
      body: n.body,
      tx_hash: n.tx_hash ?? null,
      network: n.network,
      created_at: n.created_at,
      read: n.read,
      backfilled: n.backfilled,
      raw: n,
    }));
    // Dedupe by tx_hash — prefer server entries
    const seenTx = new Set(fromServer.map((n) => n.tx_hash).filter(Boolean) as string[]);
    const walletDeduped = fromWallet.filter((n) => !n.tx_hash || !seenTx.has(n.tx_hash));
    return [...fromServer, ...walletDeduped].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [serverItems, walletItems]);

  const totalUnread = serverUnread + walletUnread;
  const grouped = useMemo(() => groupByDay(merged), [merged]);

  if (!activeAddress && !user) return null;

  const handleMarkAll = async () => {
    if (activeAddress) markAllRead(activeAddress, network);
    if (user) await markAllServerNotificationsRead(user.id);
  };

  const handleClick = async (item: UnifiedItem) => {
    if (item.source === 'server') {
      await markServerNotificationRead((item.raw as ServerNotification).id);
    } else if (activeAddress) {
      markRead(activeAddress, network, (item.raw as WalletNotification).id);
    }
    if (item.tx_hash) {
      window.open(explorerUrl(item.network, item.tx_hash), '_blank');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="Wallet notifications"
        >
          <Bell className="w-4 h-4" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Activity</div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleMarkAll}
            disabled={totalUnread === 0}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[420px]">
          {merged.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              You'll see activity here as it happens.
            </div>
          ) : (
            <div className="py-1">
              {grouped.map(([label, group]) => (
                <div key={label}>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  {group.map((n) => (
                    <NotificationRow key={n.id} n={n} onClick={() => handleClick(n)} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({ n, onClick }: { n: UnifiedItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
        n.read ? '' : 'bg-primary/5'
      }`}
    >
      <span
        className={`mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full ${
          n.read ? 'bg-transparent' : 'bg-primary'
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium">{n.title}</div>
          {n.tx_hash && <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
        </div>
        <div className="truncate text-xs text-muted-foreground">{n.body}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground/80">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          {n.backfilled ? ' · while you were away' : ''}
        </div>
      </div>
    </button>
  );
}

function groupByDay(items: UnifiedItem[]): Array<[string, UnifiedItem[]]> {
  const groups = new Map<string, UnifiedItem[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const n of items) {
    const d = new Date(n.created_at);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    let label: string;
    if (day.getTime() === today.getTime()) label = 'Today';
    else if (day.getTime() === yesterday.getTime()) label = 'Yesterday';
    else label = day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const existing = groups.get(label) ?? [];
    existing.push(n);
    groups.set(label, existing);
  }
  return Array.from(groups.entries());
}
