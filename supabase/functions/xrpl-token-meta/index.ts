const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TokenQuery {
  currency: string;
  issuer: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokens } = await req.json() as { tokens: TokenQuery[] };

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'tokens array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 20 tokens per request to avoid abuse
    const limited = tokens.slice(0, 20);

    // Fetch metadata for each token from XRPL Meta API in parallel
    const results = await Promise.allSettled(
      limited.map(async (t) => {
        const identifier = `${t.currency}:${t.issuer}`;
        const url = `https://s1.xrplmeta.org/token/${encodeURIComponent(identifier)}`;
        
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          console.error(`XRPL Meta API error for ${identifier}: ${res.status}`);
          return { currency: t.currency, issuer: t.issuer, meta: null };
        }

        const data = await res.json();

        return {
          currency: t.currency,
          issuer: t.issuer,
          meta: {
            name: data.meta?.token?.name || null,
            issuer_name: data.meta?.issuer?.name || null,
            description: data.meta?.token?.description || null,
            icon: data.meta?.token?.icon || null,
            website: data.meta?.issuer?.website || data.meta?.token?.website || null,
            domain: data.meta?.issuer?.domain || null,
            trust_level: data.meta?.token?.trust_level ?? null,
            price: data.metrics?.price ?? null,
            price_currency: 'USD',
            market_cap: data.metrics?.marketcap ?? null,
            holders: data.metrics?.holders ?? null,
            supply: data.metrics?.supply ?? null,
          },
        };
      })
    );

    const tokenMeta = results.map((r) => {
      if (r.status === 'fulfilled') return r.value;
      return { currency: '', issuer: '', meta: null };
    }).filter(r => r.currency);

    return new Response(
      JSON.stringify({ tokens: tokenMeta }),
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
