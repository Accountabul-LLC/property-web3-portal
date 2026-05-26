// UnifiedWalletsOverview — aggregates XRP + token + MPT USD value across every
// connected wallet on the active network. Rendered above PortfolioSection
// when the user has more than one wallet connected. Rows expand inline to
// reveal each wallet's assets without leaving the overview card.

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Layers, ChevronRight, FlaskConical, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { walletShortId } from '@/lib/walletLabel';
import { sumMptIssuerUsd } from '@/lib/mptValuation';
import type { XRPLPortfolioData } from '@/hooks/useXRPLPortfolio';
import type { TokenMetaData, TokenMetaResult } from '@/hooks/useTokenMeta';

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

export default function UnifiedWalletsOverview() {
  const navigate = useNavigate();
  const { wallets, activeAddress, activeNetwork, setActiveWallet } = useActiveWallet();
  const network: 'mainnet' | 'testnet' = activeNetwork === 'testnet' ? 'testnet' : 'mainnet';
  const isTestnet = network === 'testnet';

  // Fetch all wallets in parallel
  const portfolioQueries = useQueries({
    queries: wallets.map((w) => ({
      queryKey: ['xrpl_portfolio', w.address, network],
      queryFn: async (): Promise<XRPLPortfolioData> => {
        const { data, error } = await supabase.functions.invoke('xrpl-account-data', {
          body: { wallet_address: w.address, network },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        return data as XRPLPortfolioData;
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    })),
  });

  // Token metadata per wallet (for IOU price lookups). Keyed on its tokens.
  const metaQueries = useQueries({
    queries: wallets.map((w, idx) => {
      const data = portfolioQueries[idx].data;
      const tokens = data?.token_holdings.map((t) => ({ currency: t.currency, issuer: t.issuer })) || [];
      const key = tokens.map((t) => `${t.currency}:${t.issuer}`).sort().join(',');
      return {
        queryKey: ['token_meta', key],
        queryFn: async (): Promise<TokenMetaData> => {
          const { data: r, error } = await supabase.functions.invoke('xrpl-token-meta', { body: { tokens } });
          if (error) throw error;
          const map = new Map();
          for (const item of (r.tokens || []) as TokenMetaResult[]) {
            if (item.meta) map.set(`${item.currency}:${item.issuer}`, item.meta);
          }
          return { tokenMap: map, xrpUsd: r.xrp_usd || 0 };
        },
        enabled: !!data,
        staleTime: 8_000,
      };
    }),
  });

  const summaries: WalletSummary[] = useMemo(
    () =>
      wallets.map((w, idx) => {
        const q = portfolioQueries[idx];
        const m = metaQueries[idx];
        const xrpUsd = m.data?.xrpUsd ?? 0;
        const xrpBal = q.data?.xrp_balance ?? 0;
        let total = xrpBal * xrpUsd;
        for (const t of q.data?.token_holdings || []) {
          const meta = m.data?.tokenMap.get(`${t.currency}:${t.issuer}`);
          if (meta?.price && meta.price > 0) total += Number(t.balance) * meta.price;
        }
        total += sumMptIssuerUsd(q.data?.mpt_issuances);
        return {
          address: w.address,
          label: w.label || w.xamanName || walletShortId(w.address),
          xrpBalance: xrpBal,
          tokenCount: q.data?.token_holdings?.length ?? 0,
          mptCount: (q.data?.mpt_issuances?.length ?? 0) + (q.data?.mpt_holdings?.length ?? 0),
          totalUsd: total,
          hasUsd: total > 0,
          isLoading: q.isLoading,
        };
      }),
    [wallets, portfolioQueries, metaQueries],
  );

  const totals = useMemo(() => {
    const totalXrp = summaries.reduce((sum, s) => sum + s.xrpBalance, 0);
    const totalUsd = summaries.reduce((sum, s) => sum + s.totalUsd, 0);
    const totalTokens = summaries.reduce((sum, s) => sum + s.tokenCount + s.mptCount, 0);
    return { totalXrp, totalUsd, totalTokens, count: summaries.length };
  }, [summaries]);

  if (wallets.length < 2) return null;

  const handleSelect = (address: string) => {
    setActiveWallet(address);
    navigate(`/portfolio?account=${address}`);
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
        {summaries.map((s) => (
          <button
            key={s.address}
            onClick={() => handleSelect(s.address)}
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
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
