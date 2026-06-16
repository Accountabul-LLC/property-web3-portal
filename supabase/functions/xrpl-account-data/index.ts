import { createCorsHeaders } from '../_shared/cors.ts';
import { safeErrorMessage } from "../_shared/errors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { parseJsonBody } from "../_shared/auth.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const MAINNET_NODES = ['https://s2.ripple.com:51234', 'https://s1.ripple.com:51234', 'https://xrplcluster.com'];
const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'];
const CACHE_TTL_MS = 30_000;           // L1 in-memory fresh window
const FRESH_TTL_MS = 30_000;            // Postgres L2 fresh window
const STALE_TTL_MS = 5 * 60_000;        // Stale-while-revalidate window
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const accountDataRequestSchema = z.object({
  wallet_address: z.string().trim().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, 'wallet_address must be a valid XRPL address'),
  network: z.enum(['testnet', 'mainnet']).optional(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const dbClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

// Single-flight: collapse concurrent fetches for the same wallet+network
const inFlight = new Map<string, Promise<unknown>>();

async function readPgCache(wallet: string, network: string): Promise<{ payload: unknown; ageMs: number } | null> {
  if (!dbClient) return null;
  try {
    const { data } = await dbClient
      .from('xrpl_account_cache')
      .select('payload, fetched_at')
      .eq('wallet_address', wallet)
      .eq('network', network)
      .maybeSingle();
    if (!data) return null;
    const ageMs = Date.now() - new Date(data.fetched_at as string).getTime();
    return { payload: data.payload, ageMs };
  } catch {
    return null;
  }
}

async function writePgCache(wallet: string, network: string, payload: unknown) {
  if (!dbClient) return;
  try {
    await dbClient
      .from('xrpl_account_cache')
      .upsert({ wallet_address: wallet, network, payload, fetched_at: new Date().toISOString() }, { onConflict: 'wallet_address,network' });
  } catch (e) {
    console.error('xrpl_account_cache upsert failed:', e);
  }
}

const responseCache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached(key: string): unknown | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown) {
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  if (responseCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (now > v.expiresAt) responseCache.delete(k);
    }
  }
}

async function xrplRequest(nodes: string[], method: string, params: Record<string, unknown>[]) {
  let lastError: Error | null = null;
  for (const node of nodes) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        const res = await fetch(node, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method, params }),
        });
        // Handle HTTP-level rate limiting
        if (res.status === 429 || res.status === 503) {
          lastError = new Error(`${node} returned ${res.status}`);
          console.warn(`${node} returned ${res.status}, attempt ${attempt + 1}`);
          if (attempt < MAX_RETRIES) continue; // retry same node
          break; // try next node
        }
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          lastError = new Error(`Non-JSON from ${node} (${res.status}): ${text.slice(0, 120)}`);
          if (text.toLowerCase().includes('rate limit')) {
            console.warn(`Rate limited by ${node}, attempt ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
          }
          break; // try next node
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        break; // network error, try next node immediately
      }
    }
  }
  throw lastError || new Error('All XRPL nodes failed');
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function decodeHexString(hex: string): string {
  try {
    return hex.match(/../g)?.map((h: string) => String.fromCharCode(parseInt(h, 16))).join('') || '';
  } catch {
    return '';
  }
}

// Reverse map for property type short codes
const PT_REVERSE: Record<string, string> = {
  sfh: 'Single Family', mf: 'Multi-Family', condo: 'Condo / Apartment',
  th: 'Townhouse', comm: 'Commercial', ind: 'Industrial',
  land: 'Land / Lot', mix: 'Mixed-Use', other: 'Other',
};

// Compact key labels for display
const AI_KEY_LABELS: Record<string, string> = {
  adr: 'Address', ct: 'City', st: 'State', zip: 'ZIP', cc: 'Country',
  pt: 'Type', b: 'Beds', ba: 'Baths', sf: 'SqFt', yb: 'Built',
  val: 'Value', cur: 'Currency', asof: 'As Of', em: 'Contact',
  address: 'Address', city: 'City', state: 'State', country: 'Country',
  property_type: 'Type', bedrooms: 'Beds', bathrooms: 'Baths', sqft: 'SqFt', year_built: 'Built',
  value_usd: 'Asset Value (USD)', contact: 'Contact',
};

function parseMPTIssuances(objects: any[]) {
  return objects
    .filter((obj: any) => obj.LedgerEntryType === 'MPTokenIssuance')
    .map((obj: any) => {
      let metadata: Record<string, any> = {};
      if (obj.MPTokenMetadata) {
        const decoded = decodeHexString(obj.MPTokenMetadata);
        try {
          metadata = JSON.parse(decoded);
        } catch {
          if (decoded && /^[\x20-\x7E\s]+$/.test(decoded)) {
            metadata = { name: decoded };
          }
        }
      }

      const isCompressed = 'n' in metadata || 't' in metadata;

      let name: string | null = null;
      let description: string | null = null;
      let image: string | null = null;
      let ticker: string | null = null;
      let asset_class: string | null = null;
      let asset_subclass: string | null = null;
      let issuer_name: string | null = null;
      let uris: string[] | null = null;
      let nft_type: string | null = null;
      let collection: { name?: string; family?: string } | null = null;
      let attributes: Array<{ trait_type: string; value: string | number }> | null = null;

      if (isCompressed) {
        // XLS-89 compressed format
        ticker = metadata.t || null;
        name = metadata.n || null;
        description = metadata.d || null;
        image = metadata.i || null;
        asset_class = metadata.ac || null;
        asset_subclass = metadata.as || null;
        issuer_name = metadata.in || null;
        uris = Array.isArray(metadata.us) ? metadata.us : null;

        // Reconstruct collection for backward compat
        if (asset_class || asset_subclass) {
          collection = {
            name: asset_class === 'rwa' ? 'RWA Token' : (asset_class || undefined),
            family: asset_subclass ? (PT_REVERSE[asset_subclass] || asset_subclass) : undefined,
          };
        }

        // Reconstruct attributes from ai (additional_info)
        if (metadata.ai && typeof metadata.ai === 'object') {
          const attrs: Array<{ trait_type: string; value: string | number }> = [];
          for (const [key, val] of Object.entries(metadata.ai)) {
            if (val !== null && val !== undefined && key !== 'cur' && key !== 'asof') {
              const label = AI_KEY_LABELS[key] || key;
              // Expand property type short code
              const displayVal = key === 'pt' && typeof val === 'string' && PT_REVERSE[val]
                ? PT_REVERSE[val]
                : val;
              attrs.push({ trait_type: label, value: displayVal as string | number });
            }
          }
          if (attrs.length > 0) attributes = attrs;
        }
      } else {
        name = metadata.name || null;
        description = metadata.description || null;
        image = metadata.image || null;
        nft_type = metadata.nftType || null;
        collection = metadata.collection || null;
        attributes = Array.isArray(metadata.attributes) ? metadata.attributes : null;
      }

      // Extract estimated asset value in USD if present (XLS-89 ai.value_usd or ai.val)
      let value_usd: number | null = null;
      if (metadata.ai && typeof metadata.ai === 'object') {
        const raw = (metadata.ai as any).value_usd ?? (metadata.ai as any).val;
        const n = raw != null ? Number(raw) : NaN;
        if (Number.isFinite(n) && n > 0) value_usd = n;
      }

      return {
        mpt_issuance_id: obj.MPTokenIssuanceID || obj.mpt_issuance_id || null,
        issuer: obj.Issuer || obj.Account || null,
        max_amount: obj.MaximumAmount ? String(obj.MaximumAmount) : null,
        outstanding_amount: obj.OutstandingAmount ? String(obj.OutstandingAmount) : null,
        asset_scale: obj.AssetScale ?? 0,
        transfer_fee: obj.TransferFee ?? 0,
        flags: obj.Flags ?? 0,
        metadata_hex: obj.MPTokenMetadata || null,
        name,
        description,
        image,
        nft_type,
        collection,
        attributes,
        schema: metadata.schema || null,
        // New compressed fields
        ticker,
        asset_class,
        asset_subclass,
        issuer_name,
        uris,
        value_usd,
      };
    });
}

function parseMPTHoldings(objects: any[]) {
  return objects
    .filter((obj: any) => obj.LedgerEntryType === 'MPToken')
    .map((obj: any) => ({
      mpt_issuance_id: obj.MPTokenIssuanceID || null,
      amount: obj.MPTAmount ? String(obj.MPTAmount) : '0',
      flags: obj.Flags ?? 0,
      locked_amount: obj.LockedAmount ? String(obj.LockedAmount) : null,
    }));
}

function parseTransactions(txList: any[], wallet_address: string) {
  return txList.map((entry: any) => {
    const tx = entry.tx || entry.tx_json || {};
    const meta = entry.meta || {};
    const date = tx.date
      ? new Date((tx.date + 946684800) * 1000).toISOString()
      : null;

    let amount = 0;
    let currency = 'XRP';
    let txType = tx.TransactionType || 'Unknown';
    let issuer: string | null = null;

    if (tx.Amount) {
      if (typeof tx.Amount === 'string') {
        amount = Number(tx.Amount) / 1_000_000;
        currency = 'XRP';
      } else if (tx.Amount.value) {
        amount = Number(tx.Amount.value);
        currency = tx.Amount.currency;
        issuer = tx.Amount.issuer || null;
      }
    }

    const delivered = meta.delivered_amount;
    let deliveredAmount: number | null = null;
    let deliveredCurrency: string | null = null;
    if (delivered) {
      if (typeof delivered === 'string') {
        deliveredAmount = Number(delivered) / 1_000_000;
        deliveredCurrency = 'XRP';
      } else if (delivered.value) {
        deliveredAmount = Number(delivered.value);
        deliveredCurrency = delivered.currency;
      }
    }

    const direction = tx.Destination === wallet_address ? 'received' : 'sent';
    const sender = tx.Account || null;
    const destination = tx.Destination || null;

    const memos: string[] = [];
    if (tx.Memos && Array.isArray(tx.Memos)) {
      for (const m of tx.Memos) {
        if (m.Memo?.MemoData) {
          try {
            const text = decodeHexString(m.Memo.MemoData);
            if (text && /^[\x20-\x7E\s]+$/.test(text)) memos.push(text);
          } catch {}
        }
      }
    }

    const balanceChanges: Array<{ account: string; currency: string; issuer?: string; value: number }> = [];
    if (meta.AffectedNodes) {
      for (const node of meta.AffectedNodes) {
        const modified = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
        if (!modified) continue;
        if (modified.LedgerEntryType === 'RippleState') {
          const finalBal = modified.FinalFields?.Balance?.value;
          const prevBal = modified.PreviousFields?.Balance?.value;
          if (finalBal !== undefined && prevBal !== undefined) {
            const change = Number(finalBal) - Number(prevBal);
            if (change !== 0) {
              balanceChanges.push({
                account: modified.FinalFields?.HighLimit?.issuer === wallet_address
                  ? wallet_address
                  : (modified.FinalFields?.LowLimit?.issuer === wallet_address ? wallet_address : ''),
                currency: modified.FinalFields?.Balance?.currency || 'Unknown',
                issuer: modified.FinalFields?.HighLimit?.issuer === wallet_address
                  ? modified.FinalFields?.LowLimit?.issuer
                  : modified.FinalFields?.HighLimit?.issuer,
                value: change,
              });
            }
          }
        }
      }
    }

    const isSwap = txType === 'OfferCreate' ||
      (txType === 'Payment' && balanceChanges.filter(bc => bc.account === wallet_address).length > 1);

    let takerPays: { currency: string; value: number; issuer?: string } | null = null;
    let takerGets: { currency: string; value: number; issuer?: string } | null = null;
    if (tx.TakerPays) {
      if (typeof tx.TakerPays === 'string') {
        takerPays = { currency: 'XRP', value: Number(tx.TakerPays) / 1_000_000 };
      } else {
        takerPays = { currency: tx.TakerPays.currency, value: Number(tx.TakerPays.value), issuer: tx.TakerPays.issuer };
      }
    }
    if (tx.TakerGets) {
      if (typeof tx.TakerGets === 'string') {
        takerGets = { currency: 'XRP', value: Number(tx.TakerGets) / 1_000_000 };
      } else {
        takerGets = { currency: tx.TakerGets.currency, value: Number(tx.TakerGets.value), issuer: tx.TakerGets.issuer };
      }
    }

    return {
      hash: tx.hash,
      type: isSwap ? 'Swap' : txType,
      direction,
      amount,
      currency,
      issuer,
      delivered_amount: deliveredAmount,
      delivered_currency: deliveredCurrency,
      date,
      fee: tx.Fee ? Number(tx.Fee) / 1_000_000 : 0,
      sender,
      destination,
      destination_tag: tx.DestinationTag ?? null,
      memos: memos.length > 0 ? memos : null,
      result: meta.TransactionResult || null,
      is_swap: isSwap,
      taker_pays: takerPays,
      taker_gets: takerGets,
      balance_changes: balanceChanges.length > 0 ? balanceChanges : null,
    };
  });
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await parseJsonBody<unknown>(req, corsHeaders);
    if (body instanceof Response) return body;

    const parsed = accountDataRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return new Response(JSON.stringify({ error: firstIssue?.message || 'Invalid request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { wallet_address, network } = parsed.data;
    const net = network || 'mainnet';
    const nodes = net === 'testnet' ? TESTNET_NODES : MAINNET_NODES;
    const cacheKey = `${net}:${wallet_address}`;

    // L1: in-memory fresh
    const memHit = getCached(cacheKey);
    if (memHit) {
      return new Response(JSON.stringify(memHit), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT-MEM' },
      });
    }

    // Worker that does the full upstream fetch and writes both caches
    const doFetch = async () => {
      const accountInfoRes = await xrplRequest(nodes, 'account_info', [{ account: wallet_address, ledger_index: 'validated' }]);
      await delay(100);
      const accountLinesRes = await xrplRequest(nodes, 'account_lines', [{ account: wallet_address, ledger_index: 'validated' }]);
      await delay(100);
      const accountTxRes = await xrplRequest(nodes, 'account_tx', [{ account: wallet_address, ledger_index_min: -1, ledger_index_max: -1, limit: 20 }]);
      await delay(100);
      const mptIssuanceRes = await xrplRequest(nodes, 'account_objects', [{ account: wallet_address, type: 'mpt_issuance', ledger_index: 'validated' }]);
      await delay(100);
      const mptHoldingRes = await xrplRequest(nodes, 'account_objects', [{ account: wallet_address, type: 'mptoken', ledger_index: 'validated' }]);

      let xrpBalance = 0;
      let ownerCount = 0;
      const accountData = accountInfoRes.result?.account_data;
      if (accountData?.Balance) xrpBalance = Number(accountData.Balance) / 1_000_000;
      if (accountData?.OwnerCount !== undefined) ownerCount = Number(accountData.OwnerCount);

      const baseReserve = 1;
      const ownerReserve = 0.2;
      const totalReserve = baseReserve + (ownerCount * ownerReserve);
      const spendableXrp = Math.max(0, xrpBalance - totalReserve);

      const tokenHoldings = (accountLinesRes.result?.lines || []).map((line: any) => ({
        currency: line.currency,
        issuer: line.account,
        balance: Number(line.balance),
        limit: Number(line.limit),
      })).filter((t: any) => t.balance !== 0);

      const transactions = parseTransactions(accountTxRes.result?.transactions || [], wallet_address);
      const mptIssuances = parseMPTIssuances(mptIssuanceRes.result?.account_objects || []);
      const mptHoldings = parseMPTHoldings(mptHoldingRes.result?.account_objects || []);

      const responseData = {
        xrp_balance: xrpBalance,
        reserve_xrp: totalReserve,
        spendable_xrp: spendableXrp,
        owner_count: ownerCount,
        token_holdings: tokenHoldings,
        transactions,
        mpt_issuances: mptIssuances,
        mpt_holdings: mptHoldings,
        account: wallet_address,
        network: net,
      };

      setCache(cacheKey, responseData);
      await writePgCache(wallet_address, net, responseData);
      return responseData;
    };

    // Single-flight wrapper
    const runDedup = (): Promise<unknown> => {
      const existing = inFlight.get(cacheKey);
      if (existing) return existing;
      const p = doFetch().finally(() => inFlight.delete(cacheKey));
      inFlight.set(cacheKey, p);
      return p;
    };

    // L2: Postgres cache
    const pgHit = await readPgCache(wallet_address, net);
    if (pgHit && pgHit.ageMs < FRESH_TTL_MS) {
      // Fresh: serve immediately
      setCache(cacheKey, pgHit.payload);
      return new Response(JSON.stringify(pgHit.payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT-PG' },
      });
    }
    if (pgHit && pgHit.ageMs < STALE_TTL_MS) {
      // Stale-while-revalidate: serve stale, refresh in background
      try {
        // @ts-ignore EdgeRuntime is provided by Supabase Edge Functions
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(runDedup().catch(() => {}));
        } else {
          runDedup().catch(() => {});
        }
      } catch { /* non-blocking */ }
      setCache(cacheKey, pgHit.payload);
      return new Response(JSON.stringify(pgHit.payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'STALE-PG' },
      });
    }

    // Cold: must wait for upstream
    const responseData = await runDedup();
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });


  } catch (error) {
    console.error('XRPL account data error:', error);
    return new Response(JSON.stringify({ error: safeErrorMessage(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
