// UnifiedWalletsOverview - aggregates XRP + token + MPT USD value across every
// connected wallet on the active network. Rendered above PortfolioSection
// when the user has more than one wallet connected. Rows expand inline to
// reveal each wallet's assets without leaving the overview card.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Layers, ChevronRight, FlaskConical, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { walletShortId } from '@/lib/walletLabel';
import { sumMptIssuerUsd } from '@/lib/mptValuation';
import { useXRPLPortfolioBatch } from '@/hooks/useXRPLPortfolioBatch';
import type { XRPLPortfolioData } from '@/hooks/useXRPLPortfolio';
import type { TokenMeta, TokenMetaData, TokenMetaResult } from '@/hooks/useTokenMeta';

interface WalletSummary {
  address: string;
  label: string;
  xrpBalance: number;
  tokenCount: number;
  mptCount: number;
  totalUsd: number;
  hasUsd: boolean;
  isLoading: boolean;
}

// Narrow the batch payload to "successful" entries we can read like an XRPLPortfolioData.
function asPortfolio(entry: any): XRPLPortfolioData | null {
  if (!entry || 'error' in entry) return null;
  return entry as XRPLPortfolioData;
}

export default function UnifiedWalletsOverview() {
  const navigate = useNavigate();
  const { wallets, activeAddress, activeNetwork, setActiveWallet } = useActiveWallet();
  const network: 'mainnet' | 'testnet' = activeNetwork === 'testnet' ? 'testnet' : 'mainnet';
  const isTestnet = network === 'testnet';

  // One batch edge call covers every connected wallet and seeds the per-wallet
  // React Query cache (see useXRPLPortfolioBatch).
  const addresses = useMemo(() => wallets.map((w) => w.address), [wallets]);
  const { accounts, isLoading: batchLoading } = useXRPLPortfolioBatch(addresses, network);

  // Deduplicated union of IOU tokens across all wallets, capped at 20 (the
  // edge function's per-request limit). Single token-meta call instead of N.
  const unionTokens = useMemo(() => {
    const seen = new Map<string, { currency: string; issuer: string }>();
    for (const addr of addresses) {
      const p = asPortfolio(accounts[addr]);
      if (!p) continue;
      for (const t of p.token_holdings || []) {
        const key = `${t.currency}:${t.issuer}`;
        if (!seen.has(key)) seen.set(key, { currency: t.currency, issuer: t.issuer });
      }
    }
    return Array.from(seen.values()).slice(0, 20);
  }, [addresses, accounts]);

  const metaKey = unionTokens.map((t) => `${t.currency}:${t.issuer}`).sort().join(',');
  const metaQuery = useQuery({
    queryKey: ['token_meta_batch', metaKey],
    queryFn: async (): Promise<TokenMetaData> => {
      const { data: r, error } = await supabase.functions.invoke('xrpl-token-meta', {
        body: { tokens: unionTokens },
      });
      if (error) throw error;
      const map = new Map<string, TokenMeta>();
      for (const item of (r.tokens || []) as TokenMetaResult[]) {
        if (item.meta) map.set(`${item.currency}:${item.issuer}`, item.meta);
      }
      return { tokenMap: map, xrpUsd: r.xrp_usd || 0 };
    },
    enabled: unionTokens.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const xrpUsd = metaQuery.data?.xrpUsd ?? 0;
  const tokenMap = metaQuery.data?.tokenMap;

  const summaries: WalletSummary[] = useMemo(
    () =>
      wallets.map((w) => {
        const data = asPortfolio(accounts[w.address]);
        const xrpBal = data?.xrp_balance ?? 0;
        let total = xrpBal * xrpUsd;
        for (const t of data?.token_holdings || []) {
          const meta = tokenMap?.get(`${t.currency}:${t.issuer}`);
          if (meta?.price && meta.price > 0) total += Number(t.balance) * meta.price;
        }
        total += sumMptIssuerUsd(data?.mpt_issuances);
        return {
          address: w.address,
          label: w.label || w.xamanName || walletShortId(w.address),
          xrpBalance: xrpBal,
          tokenCount: data?.token_holdings?.length ?? 0,
          mptCount: (data?.mpt_issuances?.length ?? 0) + (data?.mpt_holdings?.length ?? 0),
          totalUsd: total,
          hasUsd: total > 0,
          isLoading: batchLoading && !data,
        };
      }),
    [wallets, accounts, tokenMap, xrpUsd, batchLoading],
  );

  const totals = useMemo(() => {
    const totalXrp = summaries.reduce((sum, s) => sum + s.xrpBalance, 0);
    const totalUsd = summaries.reduce((sum, s) => sum + s.totalUsd, 0);
    const totalTokens = summaries.reduce((sum, s) => sum + s.tokenCount + s.mptCount, 0);
    return { totalXrp, totalUsd, totalTokens, count: summaries.length };
  }, [summaries]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (wallets.length < 2) return null;

  const toggleExpanded = (address: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  };

  const handleSwitch = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    setActiveWallet(address);
    navigate(`/portfolio?account=${address}`);
  };

  const decodeCurrency = (cur: string) => {
    if (cur.length === 40 && /^[0-9A-Fa-f]+$/.test(cur)) {
      try {
        const bytes = cur.match(/.{2}/g) || [];
        const str = bytes
          .map((b) => String.fromCharCode(parseInt(b, 16)))
          .join('')
          .replace(/\0+$/, '')
          .trim();
        if (str) return str;
      } catch {/* noop */}
    }
    return cur;
  };

  return (
    <Card
      className={`p-6 mb-6 ${isTestnet ? 'border-amber-500/30 bg-amber-500/5' : 'border-primary/10 bg-gradient-card'}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              All Wallets · {network === 'testnet' ? 'Testnet' : 'Mainnet'}
            </p>
            {isTestnet && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                <FlaskConical className="w-3 h-3" />
                Testnet
              </Badge>
            )}
          </div>
          {totals.totalUsd > 0 ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold">
                ${totals.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-sm text-muted-foreground">
                · {totals.totalXrp.toLocaleString(undefined, { maximumFractionDigits: 2 })} XRP
                · {totals.count} {totals.count === 1 ? 'wallet' : 'wallets'}
                {totals.totalTokens > 0 && ` · ${totals.totalTokens} tokens`}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {totals.totalXrp.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
              <span className="text-lg font-medium text-muted-foreground">XRP</span>
              <span className="text-xs text-muted-foreground ml-2">
                across {totals.count} {totals.count === 1 ? 'wallet' : 'wallets'}
                {totals.totalTokens > 0 && ` · ${totals.totalTokens} tokens`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {summaries.map((s, idx) => {
          const isOpen = expanded.has(s.address);
          const pData = portfolioQueries[idx].data;
          const mData = metaQueries[idx].data;
          const xrpUsd = mData?.xrpUsd ?? 0;
          const tokenHoldings = pData?.token_holdings ?? [];
          const mptIssuances = pData?.mpt_issuances ?? [];
          const mptHoldings = pData?.mpt_holdings ?? [];
          const hasAssets =
            (pData?.xrp_balance ?? 0) > 0 ||
            tokenHoldings.length > 0 ||
            mptIssuances.length > 0 ||
            mptHoldings.length > 0;

          return (
            <div key={s.address}>
              <button
                onClick={() => toggleExpanded(s.address)}
                aria-expanded={isOpen}
                className={`w-full flex items-center justify-between gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors hover:bg-muted/40 ${
                  s.address === activeAddress ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{s.label}</p>
                      {s.address === activeAddress && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {walletShortId(s.address)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    {s.isLoading ? (
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    ) : (
                      <>
                        {s.hasUsd && (
                          <p className="text-sm font-semibold">
                            ${s.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        )}
                        <p className={`text-[11px] ${s.hasUsd ? 'text-muted-foreground' : 'text-sm font-semibold text-foreground'}`}>
                          {s.xrpBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} XRP
                          {s.tokenCount > 0 && ` · ${s.tokenCount} tok`}
                          {s.mptCount > 0 && ` · ${s.mptCount} MPT`}
                        </p>
                      </>
                    )}
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleSwitch(e, s.address)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleSwitch(e as unknown as React.MouseEvent, s.address);
                    }}
                    title="Open this wallet"
                    className="p-1.5 -m-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="ml-12 mr-2 mb-2 mt-1 p-3 rounded-lg bg-muted/30 border border-border/50 max-h-72 overflow-y-auto">
                  {s.isLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                      <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                    </div>
                  ) : !hasAssets ? (
                    <p className="text-xs text-muted-foreground">No assets in this wallet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {/* XRP */}
                      {(pData?.xrp_balance ?? 0) > 0 && (
                        <div className="flex items-center justify-between gap-3 text-xs py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-primary">X</span>
                            </div>
                            <span className="font-semibold">XRP</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-medium">
                              {(pData?.xrp_balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </p>
                            {xrpUsd > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                ${((pData?.xrp_balance ?? 0) * xrpUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* IOU tokens */}
                      {tokenHoldings.map((t) => {
                        const meta = mData?.tokenMap.get(`${t.currency}:${t.issuer}`);
                        const display = meta?.name || decodeCurrency(t.currency);
                        const bal = Number(t.balance);
                        const usd = meta?.price ? bal * meta.price : 0;
                        return (
                          <div
                            key={`${t.currency}:${t.issuer}`}
                            className="flex items-center justify-between gap-3 text-xs py-1"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {meta?.icon ? (
                                <img src={meta.icon} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                  <span className="text-[9px] font-bold text-muted-foreground">
                                    {display.slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{display}</p>
                                <p className="text-[10px] font-mono text-muted-foreground truncate">
                                  {walletShortId(t.issuer)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-medium">
                                {bal.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </p>
                              {usd > 0 && (
                                <p className="text-[10px] text-muted-foreground">
                                  ${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* MPT issuances */}
                      {mptIssuances.map((m: any) => (
                        <div
                          key={`iss-${m.mpt_issuance_id || m.MPTokenIssuanceID}`}
                          className="flex items-center justify-between gap-3 text-xs py-1"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">MPT</Badge>
                            <span className="font-mono text-[10px] truncate text-muted-foreground">
                              {(m.mpt_issuance_id || m.MPTokenIssuanceID || '').slice(0, 16)}…
                            </span>
                          </div>
                          <p className="font-medium flex-shrink-0">
                            {Number(m.outstanding_amount ?? m.OutstandingAmount ?? 0).toLocaleString()}
                          </p>
                        </div>
                      ))}

                      {/* MPT holdings */}
                      {mptHoldings.map((m: any) => (
                        <div
                          key={`hold-${m.mpt_issuance_id || m.MPTokenIssuanceID}`}
                          className="flex items-center justify-between gap-3 text-xs py-1"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">MPT</Badge>
                            <span className="font-mono text-[10px] truncate text-muted-foreground">
                              {(m.mpt_issuance_id || m.MPTokenIssuanceID || '').slice(0, 16)}…
                            </span>
                          </div>
                          <p className="font-medium flex-shrink-0">
                            {Number(m.amount ?? m.MPTAmount ?? 0).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
