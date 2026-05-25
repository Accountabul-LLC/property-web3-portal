import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com)$/i.test(origin)
    || origin === (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app'),
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Vary': 'Origin',
  };
}

const MAINNET_NODES = ['https://s2.ripple.com:51234', 'https://s1.ripple.com:51234', 'https://xrplcluster.com'];
const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

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
        if (res.status === 429 || res.status === 503) {
          lastError = new Error(`${node} returned ${res.status}`);
          console.warn(`${node} returned ${res.status}, attempt ${attempt + 1}`);
          if (attempt < MAX_RETRIES) continue;
          break;
        }
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          lastError = new Error(`Non-JSON from ${node}: ${text.slice(0, 120)}`);
          break;
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        break;
      }
    }
  }
  throw lastError || new Error('All XRPL nodes failed');
}

function isValidXRPLAddress(addr: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr);
}

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

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from_address, to_address, currency, issuer, amount, destination_tag, memo, network } = await req.json();

    const nodes = network === 'testnet' ? TESTNET_NODES : MAINNET_NODES;
    const warnings: string[] = [];

    if (!from_address || !isValidXRPLAddress(from_address)) return jsonError('Invalid sender address', 400);
    if (!to_address || !isValidXRPLAddress(to_address)) return jsonError('Invalid destination address', 400);
    if (from_address === to_address) return jsonError('Cannot send to yourself', 400);

    // --- Auth + Wallet ownership verification ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const db = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonError('Authentication required', 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonError('Invalid authentication', 401);
    const userId = user.id;

    const { data: walletLink } = await db
      .from('user_wallets')
      .select('id')
      .eq('wallet_address', from_address)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!walletLink) return jsonError('Wallet not linked to your account. Please connect it first.', 403);

    if (!currency || typeof currency !== 'string') return jsonError('Currency is required', 400);
    if (!issuer || !isValidXRPLAddress(issuer)) return jsonError('Valid issuer address is required', 400);
    if (!amount || typeof amount !== 'string' || !isPositiveDecimal(amount)) return jsonError('Amount must be a positive decimal string', 400);

    const stripped = amount.replace(/^0+/, '').replace('.', '');
    if (stripped.replace(/0+$/, '').length > 15) return jsonError('Amount exceeds maximum precision (15 significant digits)', 400);

    if (destination_tag !== undefined && destination_tag !== null && destination_tag !== '') {
      const tag = Number(destination_tag);
      if (!Number.isInteger(tag) || tag < 0 || tag > 4294967295) return jsonError('Invalid destination tag (must be integer 0-4294967295)', 400);
    }

    if (memo && typeof memo === 'string' && memo.length > 300) return jsonError('Memo too long (max 300 characters)', 400);

    // --- Fetch account data with failover ---
    const [accountInfoRes, accountLinesRes, serverInfoRes] = await Promise.all([
      xrplRequest(nodes, 'account_info', [{ account: from_address, ledger_index: 'validated' }]),
      xrplRequest(nodes, 'account_lines', [{ account: from_address, peer: issuer, ledger_index: 'validated' }]),
      xrplRequest(nodes, 'server_info', [{}]),
    ]);

    if (accountInfoRes.result?.error === 'actNotFound') return jsonError('Sender account not found on XRPL', 400);

    const accountData = accountInfoRes.result?.account_data;
    if (!accountData) return jsonError('Could not fetch account data', 500);

    // --- Trustline check ---
    const lines = accountLinesRes.result?.lines || [];
    const matchingLine = lines.find((line: any) => line.currency === currency && line.account === issuer);

    if (!matchingLine) return jsonError('TRUSTLINE_REQUIRED_SENDER: You do not have a trustline for this token', 400);
    if (matchingLine.freeze_peer) return jsonError('TOKEN_FROZEN: This token has been frozen by the issuer', 400);
    if (matchingLine.authorized === false) {
      warnings.push('This trustline may require issuer authorization. The transaction could fail.');
    }

    const senderBalance = matchingLine.balance;
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
      Amount: { currency, issuer, value: amount },
      Fee: feeDrops,
    };

    if (lastLedgerSequence > 0) txJson.LastLedgerSequence = lastLedgerSequence;

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

    const remainingBalance = Number(senderBalance) - Number(amount);
    if (remainingBalance < 0.01) {
      warnings.push('After this transaction, your token balance will be very low.');
    }
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
