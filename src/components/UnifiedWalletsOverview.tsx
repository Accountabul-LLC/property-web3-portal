// UnifiedWalletsOverview — aggregates XRP + token balances across every
// connected wallet on the active network. Rendered above PortfolioSection
// when the user has more than one wallet connected.

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wallet, Layers, ChevronRight, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { walletShortId } from '@/lib/walletLabel';
import type { XRPLPortfolioData } from '@/hooks/useXRPLPortfolio';

interface WalletSummary {
  address: string;
  label: string;
  xrpBalance: number;
  tokenCount: number;
  isLoading: boolean;
}

export default function UnifiedWalletsOverview() {
  const navigate = useNavigate();
  const { wallets, activeAddress, activeNetwork, setActiveWallet } = useActiveWallet();
  const network: 'mainnet' | 'testnet' = activeNetwork === 'testnet' ? 'testnet' : 'mainnet';
  const isTestnet = network === 'testnet';

  // Fetch all wallets in parallel (shares cache with PortfolioSection's per-wallet query)
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

  const summaries: WalletSummary[] = useMemo(
    () =>
      wallets.map((w, idx) => {
        const q = portfolioQueries[idx];
        return {
          address: w.address,
          label: w.label || w.xamanName || walletShortId(w.address),
          xrpBalance: q.data?.xrp_balance ?? 0,
          tokenCount: q.data?.token_holdings?.length ?? 0,
          isLoading: q.isLoading,
        };
      }),
    [wallets, portfolioQueries],
  );

  const totals = useMemo(() => {
    const totalXrp = summaries.reduce((sum, s) => sum + s.xrpBalance, 0);
    const totalTokens = summaries.reduce((sum, s) => sum + s.tokenCount, 0);
    const loaded = summaries.filter((s) => !s.isLoading).length;
    return { totalXrp, totalTokens, loaded, count: summaries.length };
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
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {totals.totalXrp.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
            <span className="text-lg font-medium text-muted-foreground">XRP</span>
            <span className="text-xs text-muted-foreground ml-2">
              across {totals.count} {totals.count === 1 ? 'wallet' : 'wallets'}
              {totals.totalTokens > 0 && ` · ${totals.totalTokens} token holdings`}
            </span>
          </div>
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
                    <p className="text-sm font-semibold">
                      {s.xrpBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} XRP
                    </p>
                    {s.tokenCount > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        +{s.tokenCount} {s.tokenCount === 1 ? 'token' : 'tokens'}
                      </p>
                    )}
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
