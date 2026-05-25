import { useMemo } from 'react';
import { useXRPLPortfolio } from './useXRPLPortfolio';
import { useTokenMeta } from './useTokenMeta';
import { sumMptIssuerUsd } from '@/lib/mptValuation';
import type { TreasuryWalletConfig } from '@/config/treasuryWallets';

export interface WalletValuation {
  wallet: TreasuryWalletConfig;
  totalUsd: number;
  isLoading: boolean;
  hasError: boolean;
}

export function useWalletValuation(wallet: TreasuryWalletConfig): WalletValuation {
  const { data, isLoading, error } = useXRPLPortfolio(wallet.address, wallet.network);
  const { data: tokenMetaData } = useTokenMeta(
    data?.token_holdings.map((t) => ({ currency: t.currency, issuer: t.issuer }))
  );

  const totalUsd = useMemo(() => {
    if (!data) return 0;
    const xrpUsd = tokenMetaData?.xrpUsd ?? 0;
    let total = (data.xrp_balance ?? 0) * xrpUsd;
    for (const t of data.token_holdings) {
      const meta = tokenMetaData?.tokenMap.get(`${t.currency}:${t.issuer}`);
      if (meta?.price && meta.price > 0) {
        total += Number(t.balance) * meta.price;
      }
    }
    total += sumMptIssuerUsd(data.mpt_issuances);
    return total;
  }, [data, tokenMetaData]);

  return { wallet, totalUsd, isLoading, hasError: !!error };
}
