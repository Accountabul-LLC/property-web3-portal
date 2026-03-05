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

export interface MPTIssuance {
  mpt_issuance_id: string | null;
  issuer: string | null;
  max_amount: string | null;
  outstanding_amount: string | null;
  asset_scale: number;
  transfer_fee: number;
  flags: number;
  metadata_hex: string | null;
  name: string | null;
  description: string | null;
}

export interface MPTHolding {
  mpt_issuance_id: string | null;
  amount: string;
  flags: number;
  locked_amount: string | null;
}

export interface XRPLPortfolioData {
  xrp_balance: number;
  reserve_xrp: number;
  spendable_xrp: number;
  owner_count: number;
  token_holdings: XRPLTokenHolding[];
  transactions: XRPLTransaction[];
  mpt_issuances: MPTIssuance[];
  mpt_holdings: MPTHolding[];
  account: string;
}

export function useXRPLPortfolio(walletAddress: string | null, network: 'mainnet' | 'testnet' = 'mainnet') {
  return useQuery({
    queryKey: ['xrpl_portfolio', walletAddress, network],
    queryFn: async (): Promise<XRPLPortfolioData> => {
      const { data, error } = await supabase.functions.invoke('xrpl-account-data', {
        body: { wallet_address: walletAddress, network },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as XRPLPortfolioData;
    },
    enabled: !!walletAddress,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}
