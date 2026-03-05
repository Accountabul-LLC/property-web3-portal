import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface XRPLTokenHolding {
  currency: string;
  issuer: string;
  balance: number;
  limit: number;
}

export interface XRPLTransaction {
  hash: string;
  type: string;
  direction: 'sent' | 'received';
  amount: number;
  currency: string;
  issuer?: string | null;
  delivered_amount?: number | null;
  delivered_currency?: string | null;
  date: string | null;
  fee: number;
  sender?: string | null;
  destination: string | null;
  destination_tag?: number | null;
  memos?: string[] | null;
  result: string | null;
  is_swap?: boolean;
  taker_pays?: { currency: string; value: number; issuer?: string } | null;
  taker_gets?: { currency: string; value: number; issuer?: string } | null;
  balance_changes?: Array<{ account: string; currency: string; issuer?: string; value: number }> | null;
}

export interface XRPLPortfolioData {
  xrp_balance: number;
  token_holdings: XRPLTokenHolding[];
  transactions: XRPLTransaction[];
  account: string;
}

export function useXRPLPortfolio(walletAddress: string | null) {
  return useQuery({
    queryKey: ['xrpl_portfolio', walletAddress],
    queryFn: async (): Promise<XRPLPortfolioData> => {
      const { data, error } = await supabase.functions.invoke('xrpl-account-data', {
        body: { wallet_address: walletAddress },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as XRPLPortfolioData;
    },
    enabled: !!walletAddress,
    // Keep data fresh for 15s — toggling back within 15s is instant (no network request)
    staleTime: 15_000,
    // Keep inactive wallet data in cache for 5 minutes so toggling back doesn't refetch
    gcTime: 5 * 60_000,
    // Auto-refresh active wallet every 60s (WebSocket handles real-time updates)
    refetchInterval: 60_000,
    // Refetch when user returns to the tab/page
    refetchOnWindowFocus: true,
    // Always refetch when component remounts (e.g. navigating back to portfolio)
    refetchOnMount: 'always',
  });
}
