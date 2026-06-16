// Batch portfolio fetcher for UnifiedWalletsOverview. One edge call covers
// every connected wallet, and on success we seed the per-wallet React Query
// caches so single-wallet consumers (PortfolioSection, Treasury, the WS
// watcher) read from the same data without firing their own edge calls.

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { XRPLPortfolioData } from './useXRPLPortfolio';

export interface BatchAccountsMap {
  [address: string]: XRPLPortfolioData | { error: string };
}

interface BatchResponse {
  accounts: BatchAccountsMap;
  network: 'mainnet' | 'testnet';
}

export function useXRPLPortfolioBatch(
  addresses: string[],
  network: 'mainnet' | 'testnet' = 'mainnet',
) {
  const queryClient = useQueryClient();

  const sortedAddresses = useMemo(
    () => Array.from(new Set(addresses)).sort(),
    [addresses],
  );
  const keyStr = sortedAddresses.join(',');

  const query = useQuery({
    queryKey: ['xrpl_portfolio_batch', network, keyStr],
    queryFn: async (): Promise<BatchResponse> => {
      const { data, error } = await supabase.functions.invoke('xrpl-accounts-batch', {
        body: { wallets: sortedAddresses, network },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as BatchResponse;
    },
    enabled: sortedAddresses.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 90_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  // Seed per-wallet caches so other consumers don't fire their own calls.
  useEffect(() => {
    const accounts = query.data?.accounts;
    if (!accounts) return;
    for (const [addr, payload] of Object.entries(accounts)) {
      if (payload && !('error' in payload)) {
        queryClient.setQueryData(['xrpl_portfolio', addr, network], payload);
      }
    }
  }, [query.data, network, queryClient]);

  return {
    accounts: query.data?.accounts || {},
    isLoading: query.isLoading,
    error: query.error,
  };
}
