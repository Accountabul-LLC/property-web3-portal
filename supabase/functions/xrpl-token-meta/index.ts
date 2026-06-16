import { createCorsHeaders } from '../_shared/cors.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { parseJsonBody } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const TOKEN_FRESH_MS = 60_000;          // serve cached without refresh
const TOKEN_STALE_MS = 30 * 60_000;     // serve stale + background refresh
const XRP_PRICE_FRESH_MS = 60_000;
const XRP_PRICE_STALE_MS = 10 * 60_000;

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const db = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

const tokenMetaRequestSchema = z.object({
  tokens: z.array(z.object({
    currency: z.string().trim().min(1, 'currency is required'),
    issuer: z.string().trim().min(1, 'issuer is required'),
  })).max(20, 'tokens array must not exceed 20 entries'),
});

interface CachedRow {
  meta: any;
  price_xrp: number | null;
  market_cap_xrp: number | null;
  ageMs: number;
}

const inFlightTokens = new Map<string, Promise<void>>();
let inFlightXrpPrice: Promise<number> | null = null;

async function getXrpUsdPriceCached(): Promise<number> {
  if (db) {
    try {
      const { data } = await db.from('xrpl_kv_cache').select('value, fetched_at').eq('key', 'xrp_usd').maybeSingle();
      if (data) {
        const ageMs = Date.now() - new Date(data.fetched_at as string).getTime();
        const value = Number((data.value as any)?.usd ?? 0);
        if (ageMs < XRP_PRICE_FRESH_MS && value > 0) return value;
        if (ageMs < XRP_PRICE_STALE_MS && value > 0) {
          // background refresh
          refreshXrpPrice();
          return value;
        }
      }
    } catch { /* fallthrough */ }
  }
  return await refreshXrpPrice();
}

function refreshXrpPrice(): Promise<number> {
  if (inFlightXrpPrice) return inFlightXrpPrice;
  inFlightXrpPrice = (async () => {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd',
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) return 0;
      const data = await res.json();
      const value = Number(data?.ripple?.usd ?? 0);
      if (db && value > 0) {
        await db.from('xrpl_kv_cache').upsert({ key: 'xrp_usd', value: { usd: value }, fetched_at: new Date().toISOString() }, { onConflict: 'key' });
      }
      return value;
    } catch {
      return 0;
    } finally {
      inFlightXrpPrice = null;
    }
  })();
  return inFlightXrpPrice;
}

async function readTokenCache(currency: string, issuer: string): Promise<CachedRow | null> {
  if (!db) return null;
  try {
    const { data } = await db
      .from('xrpl_token_meta_cache')
      .select('meta, price_xrp, market_cap_xrp, fetched_at')
      .eq('currency', currency)
      .eq('issuer', issuer)
      .maybeSingle();
    if (!data) return null;
    return {
      meta: data.meta,
      price_xrp: data.price_xrp != null ? Number(data.price_xrp) : null,
      market_cap_xrp: data.market_cap_xrp != null ? Number(data.market_cap_xrp) : null,
      ageMs: Date.now() - new Date(data.fetched_at as string).getTime(),
    };
  } catch {
    return null;
  }
}

async function fetchAndStoreToken(currency: string, issuer: string): Promise<CachedRow | null> {
  const key = `${currency}:${issuer}`;
  const existing = inFlightTokens.get(key);
  if (existing) {
    await existing;
    return readTokenCache(currency, issuer);
  }
  const p = (async () => {
    const identifier = `${currency}:${issuer}`;
    const url = `https://s1.xrplmeta.org/token/${encodeURIComponent(identifier)}`;
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        console.error(`xrplmeta error for ${identifier}: ${res.status}`);
        return;
      }
      const data = await res.json();
      const priceInXrp = data.metrics?.price ? Number(data.metrics.price) : null;
      const marketCapInXrp = data.metrics?.marketcap ? Number(data.metrics.marketcap) : null;
      const urls = data.meta?.token?.urls || [];
      const websiteEntry = urls.find((u: any) => u.type === 'website');
      const website = websiteEntry?.url || data.meta?.issuer?.domain || null;
      const rawMeta = {
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
      };
      if (db) {
        await db.from('xrpl_token_meta_cache').upsert({
          currency,
          issuer,
          meta: rawMeta,
          price_xrp: priceInXrp,
          market_cap_xrp: marketCapInXrp,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'currency,issuer' });
      }
    } catch (e) {
      console.error(`Error fetching ${identifier}:`, e);
    } finally {
      inFlightTokens.delete(key);
    }
  })();
  inFlightTokens.set(key, p);
  await p;
  return readTokenCache(currency, issuer);
}

function buildTokenResponse(currency: string, issuer: string, row: CachedRow | null, xrpUsd: number) {
  if (!row || !row.meta) return { currency, issuer, meta: null };
  const priceUsd = row.price_xrp && xrpUsd ? row.price_xrp * xrpUsd : null;
  const marketCapUsd = row.market_cap_xrp && xrpUsd ? row.market_cap_xrp * xrpUsd : null;
  const volume24hUsd = row.meta.volume_24h_xrp && xrpUsd ? row.meta.volume_24h_xrp * xrpUsd : null;
  return {
    currency,
    issuer,
    meta: {
      name: row.meta.name,
      issuer_name: row.meta.issuer_name,
      description: row.meta.description,
      icon: row.meta.icon,
      website: row.meta.website,
      domain: row.meta.domain,
      trust_level: row.meta.trust_level,
      price: priceUsd,
      price_currency: 'USD',
      market_cap: marketCapUsd,
      holders: row.meta.holders,
      supply: row.meta.supply,
      trustlines: row.meta.trustlines,
      volume_24h: volume24hUsd,
      trades_24h: row.meta.exchanges_24h,
      xrp_price: xrpUsd,
    },
  };
}

function scheduleBackground(p: Promise<unknown>) {
  try {
    // @ts-ignore EdgeRuntime is provided by Supabase
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(p.catch(() => {}));
    } else {
      p.catch(() => {});
    }
  } catch { /* non-blocking */ }
}

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await parseJsonBody<unknown>(req, corsHeaders);
    if (body instanceof Response) return body;

    const parsed = tokenMetaRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return new Response(
        JSON.stringify({ error: firstIssue?.message || 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tokens } = parsed.data;

    const xrpUsd = await getXrpUsdPriceCached();

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ tokens: [], xrp_usd: xrpUsd }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limited = tokens.slice(0, 20);

    // Read all cache rows in parallel, then resolve each per SWR rules
    const cacheRows = await Promise.all(limited.map((t) => readTokenCache(t.currency, t.issuer)));

    const responseTokens = await Promise.all(limited.map(async (t, i) => {
      const row = cacheRows[i];
      if (row && row.ageMs < TOKEN_FRESH_MS) {
        return buildTokenResponse(t.currency, t.issuer, row, xrpUsd);
      }
      if (row && row.ageMs < TOKEN_STALE_MS) {
        scheduleBackground(fetchAndStoreToken(t.currency, t.issuer));
        return buildTokenResponse(t.currency, t.issuer, row, xrpUsd);
      }
      // Cold: must fetch upstream now
      const fresh = await fetchAndStoreToken(t.currency, t.issuer);
      return buildTokenResponse(t.currency, t.issuer, fresh, xrpUsd);
    }));

    return new Response(
      JSON.stringify({ tokens: responseTokens, xrp_usd: xrpUsd }),
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
