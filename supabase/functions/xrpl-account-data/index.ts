import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const XRPL_NODE = 'https://xrplcluster.com';
const CACHE_TTL_MS = 10_000; // 10 second server-side cache

// In-memory cache to prevent hammering XRPL nodes on rapid wallet toggles
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
  // Evict old entries if cache grows too large (>100 wallets)
  if (responseCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (now > v.expiresAt) responseCache.delete(k);
    }
  }
}

async function xrplRequest(method: string, params: Record<string, unknown>[]) {
  const res = await fetch(XRPL_NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address } = await req.json();
    if (!wallet_address) {
      return new Response(JSON.stringify({ error: 'wallet_address required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check server-side cache first
    const cacheKey = `account:${wallet_address}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    // Fetch account info, trustlines, and transactions in parallel
    const [accountInfoRes, accountLinesRes, accountTxRes] = await Promise.all([
      xrplRequest('account_info', [{ account: wallet_address, ledger_index: 'validated' }]),
      xrplRequest('account_lines', [{ account: wallet_address, ledger_index: 'validated' }]),
      xrplRequest('account_tx', [{ account: wallet_address, ledger_index_min: -1, ledger_index_max: -1, limit: 20 }]),
    ]);

    // Parse XRP balance and reserve (in drops, convert to XRP)
    let xrpBalance = 0;
    let ownerCount = 0;
    const accountData = accountInfoRes.result?.account_data;
    if (accountData?.Balance) {
      xrpBalance = Number(accountData.Balance) / 1_000_000;
    }
    if (accountData?.OwnerCount !== undefined) {
      ownerCount = Number(accountData.OwnerCount);
    }

    // XRPL reserve: base reserve (1 XRP) + owner reserve (0.2 XRP per owned object)
    const baseReserve = 1;
    const ownerReserve = 0.2;
    const totalReserve = baseReserve + (ownerCount * ownerReserve);
    const spendableXrp = Math.max(0, xrpBalance - totalReserve);

    // Parse trustlines/token holdings
    const tokenHoldings = (accountLinesRes.result?.lines || []).map((line: any) => ({
      currency: line.currency,
      issuer: line.account,
      balance: Number(line.balance),
      limit: Number(line.limit),
    })).filter((t: any) => t.balance !== 0);

    // Parse recent transactions with richer data
    const transactions = (accountTxRes.result?.transactions || []).map((entry: any) => {
      const tx = entry.tx || entry.tx_json || {};
      const meta = entry.meta || {};
      const date = tx.date
        ? new Date((tx.date + 946684800) * 1000).toISOString()
        : null;

      let amount = 0;
      let currency = 'XRP';
      let txType = tx.TransactionType || 'Unknown';
      let issuer: string | null = null;

      // Parse Amount field
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

      // Use delivered_amount when available (actual amount received)
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

      // Parse memos
      const memos: string[] = [];
      if (tx.Memos && Array.isArray(tx.Memos)) {
        for (const m of tx.Memos) {
          if (m.Memo?.MemoData) {
            try {
              const hex = m.Memo.MemoData;
              const text = hex.match(/../g)?.map((h: string) => String.fromCharCode(parseInt(h, 16))).join('') || '';
              if (text && /^[\x20-\x7E\s]+$/.test(text)) memos.push(text);
            } catch {}
          }
        }
      }

      // Parse balance changes from meta for swap detection
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

      // Detect if this is likely a swap (OfferCreate with balance changes in multiple currencies)
      const isSwap = txType === 'OfferCreate' || 
        (txType === 'Payment' && balanceChanges.filter(bc => bc.account === wallet_address).length > 1);

      // For OfferCreate, parse TakerPays/TakerGets
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

    const responseData = {
      xrp_balance: xrpBalance,
      reserve_xrp: totalReserve,
      spendable_xrp: spendableXrp,
      owner_count: ownerCount,
      token_holdings: tokenHoldings,
      transactions,
      account: wallet_address,
    };

    // Cache the response
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
