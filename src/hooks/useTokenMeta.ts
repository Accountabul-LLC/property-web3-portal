import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TokenMeta {
  name: string | null;
  issuer_name: string | null;
  description: string | null;
  icon: string | null;
  website: string | null;
  domain: string | null;
  trust_level: number | null;
  price: number | null;
  price_currency: string;
  market_cap: number | null;
  holders: number | null;
  supply: number | null;
  trustlines: number | null;
  volume_24h: number | null;
  trades_24h: number | null;
  xrp_price: number | null;
}

export interface TokenMetaResult {
  currency: string;
  issuer: string;
  meta: TokenMeta | null;
}

interface TokenQuery {
  currency: string;
  issuer: string;
}

export interface TokenMetaData {
  tokenMap: Map<string, TokenMeta>;
  xrpUsd: number;
}

export function useTokenMeta(tokens: TokenQuery[] | undefined) {
  // Create a stable key from sorted token identifiers
  const key = tokens
    ?.map((t) => `${t.currency}:${t.issuer}`)
    .sort()
    .join(',') || '';

  return useQuery({
    queryKey: ['token_meta', key],
    queryFn: async (): Promise<TokenMetaData> => {
      if (!tokens || tokens.length === 0) return { tokenMap: new Map(), xrpUsd: 0 };

      const { data, error } = await supabase.functions.invoke('xrpl-token-meta', {
        body: { tokens },
      });

      if (error) throw error;

      const map = new Map<string, TokenMeta>();
      for (const item of (data.tokens || []) as TokenMetaResult[]) {
        if (item.meta) {
          map.set(`${item.currency}:${item.issuer}`, item.meta);
        }
      }
      return { tokenMap: map, xrpUsd: data.xrp_usd || 0 };
    },
    enabled: !!tokens && tokens.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
