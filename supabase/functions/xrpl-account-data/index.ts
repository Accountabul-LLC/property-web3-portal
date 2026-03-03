import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const XRPL_NODE = 'https://xrplcluster.com';

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

    // Fetch account info, trustlines, and transactions in parallel
    const [accountInfoRes, accountLinesRes, accountTxRes] = await Promise.all([
      xrplRequest('account_info', [{ account: wallet_address, ledger_index: 'validated' }]),
      xrplRequest('account_lines', [{ account: wallet_address, ledger_index: 'validated' }]),
      xrplRequest('account_tx', [{ account: wallet_address, ledger_index_min: -1, ledger_index_max: -1, limit: 20 }]),
    ]);

    // Parse XRP balance (in drops, convert to XRP)
    let xrpBalance = 0;
    if (accountInfoRes.result?.account_data?.Balance) {
      xrpBalance = Number(accountInfoRes.result.account_data.Balance) / 1_000_000;
    }

    // Parse trustlines/token holdings
    const tokenHoldings = (accountLinesRes.result?.lines || []).map((line: any) => ({
      currency: line.currency,
      issuer: line.account,
      balance: Number(line.balance),
      limit: Number(line.limit),
    })).filter((t: any) => t.balance !== 0);

    // Parse recent transactions
    const transactions = (accountTxRes.result?.transactions || []).map((entry: any) => {
      const tx = entry.tx || entry.tx_json || {};
      const meta = entry.meta || {};
      const date = tx.date
        ? new Date((tx.date + 946684800) * 1000).toISOString()
        : null;

      let amount = 0;
      let currency = 'XRP';
      let txType = tx.TransactionType || 'Unknown';

      if (tx.Amount) {
        if (typeof tx.Amount === 'string') {
          amount = Number(tx.Amount) / 1_000_000;
          currency = 'XRP';
        } else if (tx.Amount.value) {
          amount = Number(tx.Amount.value);
          currency = tx.Amount.currency;
        }
      }

      // Determine direction relative to the queried wallet
      const direction = tx.Destination === wallet_address ? 'received' : 'sent';

      return {
        hash: tx.hash,
        type: txType,
        direction,
        amount,
        currency,
        date,
        fee: tx.Fee ? Number(tx.Fee) / 1_000_000 : 0,
        destination: tx.Destination || null,
        result: meta.TransactionResult || null,
      };
    });

    return new Response(JSON.stringify({
      xrp_balance: xrpBalance,
      token_holdings: tokenHoldings,
      transactions,
      account: wallet_address,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('XRPL account data error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
