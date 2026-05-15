import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TokenPickerToken {
  currency: string;
  issuer: string;
  name: string | null;
  icon: string | null;
  issuer_name?: string | null;
  domain?: string | null;
  trustlines?: number | null;
  price_usd?: number | null;
  balance?: number;
  balance_usd?: number | null;
  source?: 'wallet' | 'ledger' | 'xrp';
}

export interface PropertyPickerOption {
  property_id: string;
  symbol: string;
  title: string;
  image: string | null;
  tokens_owned: number;
  total_tokens: number;
  ownership_pct: number;
  per_token_usd: number;
  holding_usd: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (token: TokenPickerToken | { kind: 'xrp' } | { kind: 'property'; property: PropertyPickerOption }) => void;
  walletTokens: TokenPickerToken[];
  propertyHoldings?: PropertyPickerOption[];
  xrpBalance: number;
  xrpUsd: number;
  showXrp?: boolean;
  hideBalances?: boolean;
  title?: string;
}

function decodeCurrency(hexOrText: string) {
  if (!hexOrText || hexOrText.length <= 3) return hexOrText;
  if (!/^[0-9A-F]+$/i.test(hexOrText) || hexOrText.length % 2 !== 0) return hexOrText;
  try {
    const decoded = hexOrText
      .match(/.{1,2}/g)
      ?.map((p) => String.fromCharCode(parseInt(p, 16)))
      .join('') ?? hexOrText;
    return decoded.replace(/\0+$/g, '').trim() || hexOrText;
  } catch {
    return hexOrText;
  }
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

const XRP_LOGO = 'https://cryptologos.cc/logos/xrp-xrp-logo.png';

export const TokenPickerDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  onSelect,
  walletTokens,
  xrpBalance,
  xrpUsd,
  showXrp = true,
  hideBalances = false,
  title = 'Select a token',
}) => {
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['xrpl-token-search', debounced],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('xrpl-token-search', {
        body: { query: debounced, limit: 30 },
      });
      if (error) throw error;
      return data as { tokens: TokenPickerToken[]; xrp_usd: number };
    },
    enabled: open,
    staleTime: 60_000,
  });

  const ledgerTokens = data?.tokens || [];

  // Merge: wallet tokens first, then ledger tokens not already in wallet
  const merged = React.useMemo<TokenPickerToken[]>(() => {
    const seen = new Set(walletTokens.map((t) => `${t.currency}:${t.issuer}`));
    const ledger = ledgerTokens
      .filter((t) => !seen.has(`${t.currency}:${t.issuer}`))
      .map((t) => ({ ...t, source: 'ledger' as const }));
    return [...walletTokens.map((t) => ({ ...t, source: 'wallet' as const })), ...ledger];
  }, [walletTokens, ledgerTokens]);

  const filtered = React.useMemo(() => {
    if (!debounced) return merged;
    const q = debounced.toLowerCase();
    return merged.filter((t) => {
      const sym = decodeCurrency(t.currency).toLowerCase();
      return (
        sym.includes(q) ||
        (t.name || '').toLowerCase().includes(q) ||
        (t.issuer_name || '').toLowerCase().includes(q) ||
        t.issuer.toLowerCase().includes(q)
      );
    });
  }, [merged, debounced]);

  const handleSelect = (t: TokenPickerToken) => {
    onSelect(t);
    onOpenChange(false);
  };

  const xrpMatchesQuery = !debounced || 'xrp'.includes(debounced.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search name, symbol, or issuer address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {showXrp && xrpMatchesQuery && (
            <button
              onClick={() => {
                onSelect({ kind: 'xrp' });
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted/60 transition-colors text-left"
            >
              <img src={XRP_LOGO} alt="XRP" className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">XRP</div>
                <div className="text-xs text-muted-foreground">Native XRPL asset</div>
              </div>
              {!hideBalances && (
                <div className="text-right text-xs">
                  <div className="font-medium">{xrpBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                  {xrpUsd > 0 && (
                    <div className="text-muted-foreground">
                      ${(xrpBalance * xrpUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              )}
            </button>
          )}

          {filtered.map((t) => {
            const sym = decodeCurrency(t.currency);
            const isWallet = t.source === 'wallet';
            return (
              <button
                key={`${t.currency}:${t.issuer}`}
                onClick={() => handleSelect(t)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/60 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground relative">
                  <span className="absolute inset-0 flex items-center justify-center">
                    {sym.slice(0, 2).toUpperCase()}
                  </span>
                  {t.icon && (
                    <img
                      src={t.icon}
                      alt={sym}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="relative h-full w-full object-cover"
                      onError={(e) => ((e.currentTarget.style.display = 'none'))}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{t.name || sym}</span>
                    {isWallet && (
                      <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        In wallet
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {sym} · {t.issuer_name || t.domain || shortAddr(t.issuer)}
                  </div>
                </div>
                {!hideBalances && (
                  <div className="text-right text-xs">
                    {isWallet ? (
                      <>
                        <div className="font-medium">
                          {(t.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </div>
                        {t.balance_usd != null && (
                          <div className="text-muted-foreground">
                            ${t.balance_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {t.price_usd != null && (
                          <div className="font-medium">${t.price_usd.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                        )}
                        {t.trustlines != null && (
                          <div className="text-muted-foreground">{t.trustlines.toLocaleString()} lines</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </button>
            );
          })}

          {isFetching && (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching XRP Ledger...
            </div>
          )}

          {!isFetching && filtered.length === 0 && !xrpMatchesQuery && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No tokens found for "{debounced}".
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TokenPickerDialog;
