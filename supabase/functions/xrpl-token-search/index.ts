import { createCorsHeaders } from '../_shared/cors.ts';
async function getXrpUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd',
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.ripple?.usd ?? 0;
  } catch {
    return 0;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const query: string = (body.query || '').toString().trim();
    const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 50);

    const params = new URLSearchParams({
      sort_by: 'trustlines',
      limit: String(limit),
      include_changes: 'false',
    });
    params.append('trust_level[]', '1');
    params.append('trust_level[]', '2');
    params.append('trust_level[]', '3');
    if (query) params.set('name_like', query);

    const url = `https://s1.xrplmeta.org/tokens?${params.toString()}`;

    const [xrpUsd, res] = await Promise.all([
      getXrpUsdPrice(),
      fetch(url, { headers: { Accept: 'application/json' } }),
    ]);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ tokens: [], xrp_usd: xrpUsd, error: `XRPL Meta ${res.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await res.json();
    const tokens = (data.tokens || []).map((t: any) => {
      const priceXrp = t.metrics?.price ? Number(t.metrics.price) : null;
      return {
        currency: t.currency,
        issuer: t.issuer,
        name: t.meta?.token?.name || null,
        issuer_name: t.meta?.issuer?.name || null,
        icon: t.meta?.token?.icon || null,
        domain: t.meta?.issuer?.domain || null,
        trust_level: t.meta?.token?.trust_level ?? null,
        trustlines: t.metrics?.trustlines ?? null,
        holders: t.metrics?.holders ?? null,
        price_usd: priceXrp && xrpUsd ? priceXrp * xrpUsd : null,
        volume_24h_usd: t.metrics?.volume_24h && xrpUsd ? Number(t.metrics.volume_24h) * xrpUsd : null,
      };
    });

    return new Response(
      JSON.stringify({ tokens, xrp_usd: xrpUsd }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
