import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PortfolioHolding {
  id: string;
  wallet_address: string;
  property_id: string;
  tokens_owned: number;
  average_purchase_price: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioTransaction {
  id: string;
  wallet_address: string;
  property_id: string;
  transaction_type: string;
  tokens: number;
  price_per_token: number;
  total_amount: number;
  tx_hash: string | null;
  status: string;
  created_at: string;
}

export function usePortfolioHoldings(walletAddress: string | null) {
  return useQuery({
    queryKey: ['portfolio_holdings', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      const { data, error } = await supabase
        .from('portfolio_holdings' as any)
        .select('*')
        .eq('wallet_address', walletAddress);
      if (error) throw error;
      return (data || []) as unknown as PortfolioHolding[];
    },
    enabled: !!walletAddress,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePortfolioTransactions(walletAddress: string | null) {
  return useQuery({
    queryKey: ['portfolio_transactions', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      const { data, error } = await supabase
        .from('portfolio_transactions' as any)
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as PortfolioTransaction[];
    },
    enabled: !!walletAddress,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
