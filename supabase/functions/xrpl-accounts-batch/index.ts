// Batch wallet fetch. Collapses N per-wallet HTTP edge invocations into one,
// while still reusing the per-wallet xrpl_account_cache rows so warm wallets
// cost ~0 ms. Failed wallets surface as { error } entries instead of failing
// the whole batch.

import { createCorsHeaders } from '../_shared/cors.ts';
import { safeErrorMessage } from '../_shared/errors.ts';
import { parseJsonBody } from '../_shared/auth.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { fetchWalletPayload } from '../_shared/xrpl-parse.ts';

const FRESH_TTL_MS = 30_000;
const STALE_TTL_MS = 5 * 60_000;
const PER_WALLET_TIMEOUT_MS = 8_000;

const requestSchema = z.object({
  wallets: z.array(z.string().trim().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, 'invalid XRPL address'))
    .min(1).max(10),
  network: z.enum(['testnet', 'mainnet']).optional(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const db = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

const inFlight = new Map<string, Promise<unknown>>();

async function readPgCache(wallet: string, network: string): Promise<{ payload: any; ageMs: number } | null> {
  if (!db) return null;
  try {
    const { data } = await db
      .from('xrpl_account_cache')
      .select('payload, fetched_at')
      .eq('wallet_address', wallet)
      .eq('network', network)
      .maybeSingle();
    if (!data) return null;
    return { payload: data.payload, ageMs: Date.now() - new Date(data.fetched_at as string).getTime() };
  } catch {
    return null;
  }
}

async function writePgCache(wallet: string, network: string, payload: unknown) {
  if (!db) return;
  try {
    await db
      .from('xrpl_account_cache')
      .upsert(
        { wallet_address: wallet, network, payload, fetched_at: new Date().toISOString() },
        { onConflict: 'wallet_address,network' },
      );
  } catch (e) {
    console.error('xrpl_account_cache upsert failed:', e);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

function scheduleBackground(p: Promise<unknown>) {
  try {
    // @ts-ignore EdgeRuntime is provided by Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(p.catch(() => {}));
    } else {
      p.catch(() => {});
    }
  } catch { /* non-blocking */ }
}

async function fetchOne(wallet: string, network: 'mainnet' | 'testnet'): Promise<any> {
  const cacheKey = `${network}:${wallet}`;

  // L2 Postgres cache: fresh -> serve, stale -> serve + background refresh.
  const pgHit = await readPgCache(wallet, network);
  if (pgHit && pgHit.ageMs < FRESH_TTL_MS) return pgHit.payload;
  if (pgHit && pgHit.ageMs < STALE_TTL_MS) {
    scheduleBackground(refreshAndStore(wallet, network, cacheKey));
    return pgHit.payload;
  }

  // Cold: must wait. Single-flight across the batch invocation.
  return await refreshAndStore(wallet, network, cacheKey);
}

function refreshAndStore(wallet: string, network: 'mainnet' | 'testnet', cacheKey: string): Promise<any> {
  const existing = inFlight.get(cacheKey);
  if (existing) return existing as Promise<any>;
  const p = (async () => {
    const payload = await withTimeout(fetchWalletPayload(wallet, network), PER_WALLET_TIMEOUT_MS);
    await writePgCache(wallet, network, payload);
    return payload;
  })().finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, p);
  return p;
}

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await parseJsonBody<unknown>(req, corsHeaders);
    if (body instanceof Response) return body;

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { wallets, network } = parsed.data;
    const net: 'mainnet' | 'testnet' = network || 'mainnet';
    const unique = Array.from(new Set(wallets));

    const results = await Promise.allSettled(unique.map((w) => fetchOne(w, net)));
    const accounts: Record<string, any> = {};
    results.forEach((r, i) => {
      const addr = unique[i];
      if (r.status === 'fulfilled') {
        accounts[addr] = r.value;
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        console.error(`batch wallet ${addr} failed:`, msg);
        accounts[addr] = { error: msg };
      }
    });

    return new Response(JSON.stringify({ accounts, network: net }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('xrpl-accounts-batch error:', error);
    return new Response(JSON.stringify({ error: safeErrorMessage(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
