import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAINNET_NODES = ['https://s2.ripple.com:51234', 'https://s1.ripple.com:51234', 'https://xrplcluster.com'];
const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'];
const CACHE_TTL_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

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

      // Detect format: compressed (XLS-89) has 'n' key, legacy (XLS-24d) has 'name' key
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
        // Legacy XLS-24d format
        name = metadata.name || null;
        description = metadata.description || null;
        image = metadata.image || null;
        nft_type = metadata.nftType || null;
        collection = metadata.collection || null;
        attributes = Array.isArray(metadata.attributes) ? metadata.attributes : null;
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, network } = await req.json();
    if (!wallet_address) {
      return new Response(JSON.stringify({ error: 'wallet_address required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nodes = network === 'testnet' ? TESTNET_NODES : MAINNET_NODES;

    const cacheKey = `${network || 'mainnet'}:${wallet_address}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    // Sequential requests with small delays to avoid rate limiting
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
    if (accountData?.Balance) {
      xrpBalance = Number(accountData.Balance) / 1_000_000;
    }
    if (accountData?.OwnerCount !== undefined) {
      ownerCount = Number(accountData.OwnerCount);
    }

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

    // Parse MPT data
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
      network: network || 'mainnet',
    };

    setCache(cacheKey, responseData);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });

  } catch (error) {
    console.error('XRPL account data error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
