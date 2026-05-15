import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PropertyHolding {
  id: string;
  property_id: string;
  tokens_owned: number;
  total_tokens: number;
  ownership_pct: number;
  per_token_usd: number;
  holding_usd: number;
  title: string;
  image: string | null;
  estimated_value: number;
  symbol: string;
}

/**
 * Returns the user's real-estate holdings enriched with valuation derived
 * from `properties.estimated_value / properties.total_tokens`. Used by the
 * Swap page so users can sell fractions of property tokens for RLUSD / XRP.
 */
export function usePropertyHoldings(walletAddress: string | null) {
  return useQuery({
    queryKey: ['property_holdings_swap', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [] as PropertyHolding[];

      const { data: holdings, error } = await supabase
        .from('portfolio_holdings' as any)
        .select('id, property_id, tokens_owned')
        .eq('wallet_address', walletAddress)
        .gt('tokens_owned', 0);
      if (error) throw error;

      const list = (holdings || []) as Array<{ id: string; property_id: string; tokens_owned: number }>;
      if (list.length === 0) return [] as PropertyHolding[];

      const ids = list.map((h) => h.property_id);
      const { data: props, error: pErr } = await supabase
        .from('properties' as any)
        .select('id, title, images, estimated_value, total_tokens, price_per_token')
        .in('id', ids);
      if (pErr) throw pErr;

      const map = new Map<string, any>();
      (props || []).forEach((p: any) => map.set(p.id, p));

      return list
        .map((h): PropertyHolding | null => {
          const p = map.get(h.property_id);
          if (!p) return null;
          const totalTokens = Number(p.total_tokens) || 0;
          const estVal = Number(p.estimated_value) || 0;
          const pricePerToken = Number(p.price_per_token) || 0;
          const perTokenUsd = totalTokens > 0 && estVal > 0
            ? estVal / totalTokens
            : pricePerToken;
          const ownershipPct = totalTokens > 0 ? (h.tokens_owned / totalTokens) * 100 : 0;
          const symbol = (p.title || 'PROP').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'PROP';
          return {
            id: h.id,
            property_id: h.property_id,
            tokens_owned: h.tokens_owned,
            total_tokens: totalTokens,
            ownership_pct: ownershipPct,
            per_token_usd: perTokenUsd,
            holding_usd: perTokenUsd * h.tokens_owned,
            title: p.title || 'Property',
            image: Array.isArray(p.images) && p.images.length ? p.images[0] : null,
            estimated_value: estVal,
            symbol,
          };
        })
        .filter((x): x is PropertyHolding => x !== null);
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
  });
}
