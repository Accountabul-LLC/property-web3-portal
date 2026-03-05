import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAINNET_NODES = ['https://xrplcluster.com', 'https://s1.ripple.com:51234'];
const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'];
const CACHE_TTL_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

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

async function xrplRequest(node: string, method: string, params: Record<string, unknown>[]) {
  const res = await fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`XRPL node returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`);
  }
}

function decodeHexString(hex: string): string {
  try {
    return hex.match(/../g)?.map((h: string) => String.fromCharCode(parseInt(h, 16))).join('') || '';
  } catch {
    return '';
  }
}

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

      return {
        mpt_issuance_id: obj.MPTokenIssuanceID || obj.mpt_issuance_id || null,
        issuer: obj.Issuer || obj.Account || null,
        max_amount: obj.MaximumAmount ? String(obj.MaximumAmount) : null,
        outstanding_amount: obj.OutstandingAmount ? String(obj.OutstandingAmount) : null,
        asset_scale: obj.AssetScale ?? 0,
        transfer_fee: obj.TransferFee ?? 0,
        flags: obj.Flags ?? 0,
        metadata_hex: obj.MPTokenMetadata || null,
        name: metadata.name || null,
        description: metadata.description || null,
        image: metadata.image || null,
        nft_type: metadata.nftType || null,
        collection: metadata.collection || null,
        attributes: Array.isArray(metadata.attributes) ? metadata.attributes : null,
        schema: metadata.schema || null,
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

    const node = network === 'testnet' ? TESTNET_NODE : MAINNET_NODE;

    const cacheKey = `${network || 'mainnet'}:${wallet_address}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    const [accountInfoRes, accountLinesRes, accountTxRes, mptIssuanceRes, mptHoldingRes] = await Promise.all([
      xrplRequest(node, 'account_info', [{ account: wallet_address, ledger_index: 'validated' }]),
      xrplRequest(node, 'account_lines', [{ account: wallet_address, ledger_index: 'validated' }]),
      xrplRequest(node, 'account_tx', [{ account: wallet_address, ledger_index_min: -1, ledger_index_max: -1, limit: 20 }]),
      xrplRequest(node, 'account_objects', [{ account: wallet_address, type: 'mpt_issuance', ledger_index: 'validated' }]),
      xrplRequest(node, 'account_objects', [{ account: wallet_address, type: 'mptoken', ledger_index: 'validated' }]),
    ]);

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
