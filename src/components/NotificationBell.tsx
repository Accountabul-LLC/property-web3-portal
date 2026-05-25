import { useSyncExternalStore, useMemo } from 'react';
import { Bell, ExternalLink, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import {
  listNotifications,
  unreadCount,
  markAllRead,
  markRead,
  subscribe,
  explorerUrl,
  WalletNotification,
} from '@/lib/walletNotifications';
import { formatDistanceToNow } from 'date-fns';

function useWalletNotifications(address: string | null, network: 'mainnet' | 'testnet') {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => `${address ?? ''}:${network}:${unreadCount(address, network)}:${listNotifications(address, network).length}`,
    () => '',
  );
  // snapshot is just a cache-busting key; reread real data each render
  void snapshot;
  return {
    items: listNotifications(address, network),
    unread: unreadCount(address, network),
  };
}

export function NotificationBell() {
  const { activeAddress, activeNetwork, user: _user } = useActiveWallet() as any;
  const network: 'mainnet' | 'testnet' = activeNetwork === 'testnet' ? 'testnet' : 'mainnet';
  const { items, unread } = useWalletNotifications(activeAddress, network);

  const grouped = useMemo(() => groupByDay(items), [items]);

  if (!activeAddress) return null;

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
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Wallet activity</div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => markAllRead(activeAddress, network)}
            disabled={unread === 0}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              You'll see wallet activity here as it happens.
            </div>
          ) : (
            <div className="py-1">
              {grouped.map(([label, group]) => (
                <div key={label}>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  {group.map(n => (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      onClick={() => {
                        markRead(activeAddress, network, n.id);
                        if (n.tx_hash) {
                          window.open(explorerUrl(network, n.tx_hash), '_blank');
                        }
                      }}
                    />
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

function NotificationRow({ n, onClick }: { n: WalletNotification; onClick: () => void }) {
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

function groupByDay(items: WalletNotification[]): Array<[string, WalletNotification[]]> {
  const groups = new Map<string, WalletNotification[]>();
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
