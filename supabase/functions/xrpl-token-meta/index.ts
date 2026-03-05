const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TokenQuery {
  currency: string;
  issuer: string;
}

/** Fetch the current XRP/USD price from CoinGecko (free, no API key) */
async function getXrpUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd',
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) {
      console.error('CoinGecko API error:', res.status);
      return 0;
    }
    const data = await res.json();
    return data?.ripple?.usd ?? 0;
  } catch (e) {
    console.error('Failed to fetch XRP/USD price:', e);
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokens } = await req.json() as { tokens: TokenQuery[] };

    if (!tokens || !Array.isArray(tokens)) {
      return new Response(
        JSON.stringify({ error: 'tokens array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle empty tokens array — still return XRP/USD price
    if (tokens.length === 0) {
      const xrpUsd = await getXrpUsdPrice();
      return new Response(
        JSON.stringify({ tokens: [], xrp_usd: xrpUsd }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 20 tokens per request to avoid abuse
    const limited = tokens.slice(0, 20);

    // Fetch XRP/USD price and all token metadata in parallel
    const [xrpUsd, ...results] = await Promise.all([
      getXrpUsdPrice(),
      ...limited.map(async (t) => {
        const identifier = `${t.currency}:${t.issuer}`;
        const url = `https://s1.xrplmeta.org/token/${encodeURIComponent(identifier)}`;
        
        try {
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
          });

          if (!res.ok) {
            console.error(`XRPL Meta API error for ${identifier}: ${res.status}`);
            return { currency: t.currency, issuer: t.issuer, meta: null };
          }

          const data = await res.json();

          // xrplmeta prices are denominated in XRP — convert to USD
          const priceInXrp = data.metrics?.price ? Number(data.metrics.price) : null;
          const marketCapInXrp = data.metrics?.marketcap ? Number(data.metrics.marketcap) : null;

          // Extract website from urls array or issuer domain
          const urls = data.meta?.token?.urls || [];
          const websiteEntry = urls.find((u: any) => u.type === 'website');
          const website = websiteEntry?.url || data.meta?.issuer?.domain || null;

          return {
            currency: t.currency,
            issuer: t.issuer,
            priceInXrp,
            marketCapInXrp,
            rawMeta: {
              name: data.meta?.token?.name || null,
              issuer_name: data.meta?.issuer?.name || null,
              description: data.meta?.token?.desc || data.meta?.token?.description || null,
              icon: data.meta?.token?.icon || null,
              website,
              domain: data.meta?.issuer?.domain || null,
              trust_level: data.meta?.token?.trust_level ?? null,
              holders: data.metrics?.holders ?? null,
              supply: data.metrics?.supply ? Number(data.metrics.supply) : null,
              trustlines: data.metrics?.trustlines ?? null,
              volume_24h_xrp: data.metrics?.volume_24h ? Number(data.metrics.volume_24h) : null,
              exchanges_24h: data.metrics?.exchanges_24h ? Number(data.metrics.exchanges_24h) : null,
            },
          };
        } catch (e) {
          console.error(`Error fetching ${identifier}:`, e);
          return { currency: t.currency, issuer: t.issuer, meta: null };
        }
      }),
    ]);

    console.log(`XRP/USD price: $${xrpUsd}`);

    // Convert XRP-denominated prices to USD
    const tokenMeta = results.map((r: any) => {
      if (!r || !r.currency) return null;
      if (r.meta === null) return { currency: r.currency, issuer: r.issuer, meta: null };

      const priceUsd = r.priceInXrp && xrpUsd ? r.priceInXrp * xrpUsd : null;
      const marketCapUsd = r.marketCapInXrp && xrpUsd ? r.marketCapInXrp * xrpUsd : null;
      const volume24hUsd = r.rawMeta?.volume_24h_xrp && xrpUsd ? r.rawMeta.volume_24h_xrp * xrpUsd : null;

      return {
        currency: r.currency,
        issuer: r.issuer,
        meta: {
          name: r.rawMeta.name,
          issuer_name: r.rawMeta.issuer_name,
          description: r.rawMeta.description,
          icon: r.rawMeta.icon,
          website: r.rawMeta.website,
          domain: r.rawMeta.domain,
          trust_level: r.rawMeta.trust_level,
          price: priceUsd,
          price_currency: 'USD',
          market_cap: marketCapUsd,
          holders: r.rawMeta.holders,
          supply: r.rawMeta.supply,
          trustlines: r.rawMeta.trustlines,
          volume_24h: volume24hUsd,
          trades_24h: r.rawMeta.exchanges_24h,
          xrp_price: xrpUsd,
        },
      };
    }).filter(Boolean);

    return new Response(
      JSON.stringify({ tokens: tokenMeta, xrp_usd: xrpUsd }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
