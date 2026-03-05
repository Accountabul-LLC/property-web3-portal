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

/** Decimal-safe comparison: returns -1, 0, or 1 */
function compareDecimalStrings(a: string, b: string): number {
  const [aInt, aDec = ''] = a.replace(/^-/, '').split('.');
  const [bInt, bDec = ''] = b.replace(/^-/, '').split('.');
  const aNeg = a.startsWith('-');
  const bNeg = b.startsWith('-');

  if (aNeg && !bNeg) return -1;
  if (!aNeg && bNeg) return 1;

  const maxDecLen = Math.max(aDec.length, bDec.length);
  const aFull = aInt.padStart(40, '0') + aDec.padEnd(maxDecLen, '0');
  const bFull = bInt.padStart(40, '0') + bDec.padEnd(maxDecLen, '0');

  const cmp = aFull < bFull ? -1 : aFull > bFull ? 1 : 0;
  return (aNeg && bNeg) ? -cmp : cmp;
}

function isPositiveDecimal(s: string): boolean {
  return /^\d+(\.\d+)?$/.test(s) && compareDecimalStrings(s, '0') > 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from_address, to_address, currency, issuer, amount, destination_tag, memo } = await req.json();

    const warnings: string[] = [];

    // --- Validate inputs ---
    if (!from_address || !isValidXRPLAddress(from_address)) {
      return jsonError('Invalid sender address', 400);
    }
    if (!to_address || !isValidXRPLAddress(to_address)) {
      return jsonError('Invalid destination address', 400);
    }
    if (from_address === to_address) {
      return jsonError('Cannot send to yourself', 400);
    }

    // --- Auth + Wallet ownership verification ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const db = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Authentication required', 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonError('Invalid authentication', 401);
    }
    const userId = claimsData.claims.sub as string;

    const { data: walletLink } = await db
      .from('user_wallets')
      .select('id')
      .eq('wallet_address', from_address)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!walletLink) {
      return jsonError('Wallet not linked to your account. Please connect it first.', 403);
    }
    if (!currency || typeof currency !== 'string') {
      return jsonError('Currency is required', 400);
    }
    if (!issuer || !isValidXRPLAddress(issuer)) {
      return jsonError('Valid issuer address is required', 400);
    }
    if (!amount || typeof amount !== 'string' || !isPositiveDecimal(amount)) {
      return jsonError('Amount must be a positive decimal string', 400);
    }
    // Validate precision (max 15 significant digits for XRPL IOUs)
    const stripped = amount.replace(/^0+/, '').replace('.', '');
    if (stripped.replace(/0+$/, '').length > 15) {
      return jsonError('Amount exceeds maximum precision (15 significant digits)', 400);
    }

    if (destination_tag !== undefined && destination_tag !== null && destination_tag !== '') {
      const tag = Number(destination_tag);
      if (!Number.isInteger(tag) || tag < 0 || tag > 4294967295) {
        return jsonError('Invalid destination tag (must be integer 0-4294967295)', 400);
      }
    }

    if (memo && typeof memo === 'string' && memo.length > 300) {
      return jsonError('Memo too long (max 300 characters)', 400);
    }

    // --- Fetch account data in parallel ---
    const [accountInfoRes, accountLinesRes, serverInfoRes] = await Promise.all([
      xrplRequest('account_info', [{ account: from_address, ledger_index: 'validated' }]),
      xrplRequest('account_lines', [{ account: from_address, peer: issuer, ledger_index: 'validated' }]),
      xrplRequest('server_info', [{}]),
    ]);

    if (accountInfoRes.result?.error === 'actNotFound') {
      return jsonError('Sender account not found on XRPL', 400);
    }

    const accountData = accountInfoRes.result?.account_data;
    if (!accountData) {
      return jsonError('Could not fetch account data', 500);
    }

    // --- Trustline check ---
    const lines = accountLinesRes.result?.lines || [];
    const matchingLine = lines.find((line: any) =>
      line.currency === currency && line.account === issuer
    );

    if (!matchingLine) {
      return jsonError('TRUSTLINE_REQUIRED_SENDER: You do not have a trustline for this token', 400);
    }

    // Check if trustline is frozen by issuer
    if (matchingLine.freeze_peer) {
      return jsonError('TOKEN_FROZEN: This token has been frozen by the issuer', 400);
    }

    // Check authorized flag (if issuer requires authorization)
    if (matchingLine.authorized === false) {
      warnings.push('This trustline may require issuer authorization. The transaction could fail.');
    }

    // --- Balance check (string-safe) ---
    const senderBalance = matchingLine.balance; // string
    if (compareDecimalStrings(amount, senderBalance) > 0) {
      return jsonError(`Insufficient token balance. You have ${senderBalance} ${currency} available.`, 400);
    }

    // --- Build transaction ---
    const validatedLedger = serverInfoRes.result?.info?.validated_ledger?.seq || 0;
    const lastLedgerSequence = validatedLedger + 30;
    const feeDrops = "12";

    const txJson: Record<string, unknown> = {
      TransactionType: "Payment",
      Account: from_address,
      Destination: to_address,
      Amount: {
        currency,
        issuer,
        value: amount,
      },
      Fee: feeDrops,
    };

    if (lastLedgerSequence > 0) {
      txJson.LastLedgerSequence = lastLedgerSequence;
    }

    if (destination_tag !== undefined && destination_tag !== null && destination_tag !== '') {
      txJson.DestinationTag = Number(destination_tag);
    }

    if (memo && memo.trim()) {
      txJson.Memos = [{
        Memo: {
          MemoType: new TextEncoder().encode('text/plain').reduce((s, b) => s + b.toString(16).toUpperCase().padStart(2, '0'), ''),
          MemoData: new TextEncoder().encode(memo.trim()).reduce((s, b) => s + b.toString(16).toUpperCase().padStart(2, '0'), ''),
        }
      }];
    }

    // --- Warnings ---
    const remainingBalance = Number(senderBalance) - Number(amount);
    if (remainingBalance < 0.01) {
      warnings.push('After this transaction, your token balance will be very low.');
    }

    // Warn about destination trustline (we can't guarantee it)
    warnings.push('Ensure the recipient has a trustline for this token, otherwise the transaction will fail.');

    console.log('Built token payment tx:', JSON.stringify(txJson));

    return new Response(JSON.stringify({
      success: true,
      tx_json: txJson,
      fee_drops: feeDrops,
      fee_xrp: Number(feeDrops) / 1_000_000,
      sender_balance: senderBalance,
      currency,
      issuer,
      warnings,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Build token payment error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
