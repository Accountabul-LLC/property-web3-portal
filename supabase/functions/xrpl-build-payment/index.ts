import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function isValidXRPLAddress(addr: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from_address, to_address, amount_xrp, destination_tag, memo } = await req.json();

    // Validate inputs
    const warnings: string[] = [];

    if (!from_address || !isValidXRPLAddress(from_address)) {
      return new Response(JSON.stringify({ error: 'Invalid sender address' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!to_address || !isValidXRPLAddress(to_address)) {
      return new Response(JSON.stringify({ error: 'Invalid destination address' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (from_address === to_address) {
      return new Response(JSON.stringify({ error: 'Cannot send to yourself' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Wallet ownership verification ---
    // Verify the sender wallet was previously authenticated via Xaman sign-in
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: profile } = await supabase
      .from('wallet_profiles')
      .select('wallet_address')
      .eq('wallet_address', from_address)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Wallet not verified. Please connect via Xaman first.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amount = Number(amount_xrp);
    if (!amount_xrp || isNaN(amount) || amount <= 0 || amount > 100_000_000_000) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (destination_tag !== undefined && destination_tag !== null && destination_tag !== '') {
      const tag = Number(destination_tag);
      if (!Number.isInteger(tag) || tag < 0 || tag > 4294967295) {
        return new Response(JSON.stringify({ error: 'Invalid destination tag (must be integer 0-4294967295)' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (memo && typeof memo === 'string' && memo.length > 300) {
      return new Response(JSON.stringify({ error: 'Memo too long (max 300 characters)' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch account info and server state in parallel
    const [accountInfoRes, serverInfoRes] = await Promise.all([
      xrplRequest('account_info', [{ account: from_address, ledger_index: 'validated' }]),
      xrplRequest('server_info', [{}]),
    ]);

    if (accountInfoRes.result?.error === 'actNotFound') {
      return new Response(JSON.stringify({ error: 'Sender account not found on XRPL' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountData = accountInfoRes.result?.account_data;
    if (!accountData) {
      return new Response(JSON.stringify({ error: 'Could not fetch account data' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const balanceXrp = Number(accountData.Balance) / 1_000_000;
    const ownerCount = accountData.OwnerCount || 0;
    const reserveBase = 10; // XRP base reserve
    const reserveInc = 2;   // XRP per owner object
    const totalReserve = reserveBase + (ownerCount * reserveInc);
    const spendable = balanceXrp - totalReserve;

    if (amount > spendable) {
      return new Response(JSON.stringify({
        error: `Insufficient spendable balance. You have ${spendable.toFixed(6)} XRP available (${totalReserve} XRP reserved).`
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current ledger index for LastLedgerSequence
    const validatedLedger = serverInfoRes.result?.info?.validated_ledger?.seq || 0;
    const lastLedgerSequence = validatedLedger + 30;

    // Fee - use base fee (12 drops default)
    const feeDrops = "12";

    // Build drops amount
    const drops = String(Math.round(amount * 1_000_000));

    // Build tx JSON
    const txJson: Record<string, unknown> = {
      TransactionType: "Payment",
      Account: from_address,
      Destination: to_address,
      Amount: drops,
      Fee: feeDrops,
    };

    if (lastLedgerSequence > 0) {
      txJson.LastLedgerSequence = lastLedgerSequence;
    }

    if (destination_tag !== undefined && destination_tag !== null && destination_tag !== '') {
      txJson.DestinationTag = Number(destination_tag);
    }

    if (memo && memo.trim()) {
      const toHex = (str: string) =>
        Array.from(new TextEncoder().encode(str))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();
      txJson.Memos = [{
        Memo: {
          MemoType: toHex('text/plain'),
          MemoData: toHex(memo.trim()),
        }
      }];
    }

    // Balance warnings
    const remainingAfter = spendable - amount;
    if (remainingAfter < 1) {
      warnings.push('After this transaction, your spendable balance will be very low.');
    }

    console.log('Built payment tx:', JSON.stringify(txJson));

    return new Response(JSON.stringify({
      success: true,
      tx_json: txJson,
      fee_drops: feeDrops,
      fee_xrp: Number(feeDrops) / 1_000_000,
      balance_xrp: balanceXrp,
      spendable_xrp: spendable,
      reserve_xrp: totalReserve,
      warnings,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Build payment error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
