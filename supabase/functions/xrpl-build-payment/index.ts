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

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonError = (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // Parse body first — explicit 400 on malformed JSON
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError('Invalid request body', 400);
    }
    const { from_address, to_address, amount_xrp, destination_tag, memo, network } = body;

    // --- Auth first, before exposing any validation signals ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonError('Authentication required', 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonError('Invalid authentication', 401);
    const userId = user.id;

    // --- Input validation (all → 400, in correct order) ---
    const allowedNetworks = ['mainnet', 'testnet'];
    if (network !== undefined && !allowedNetworks.includes(network as string)) {
      return jsonError('network must be mainnet or testnet', 400);
    }
    const nodes = (network as string) === 'testnet' ? TESTNET_NODES : MAINNET_NODES;
    const warnings: string[] = [];

    const amount = Number(amount_xrp);
    if (!amount_xrp || isNaN(amount) || amount <= 0 || amount > 100_000_000_000) {
      return jsonError('Invalid amount', 400);
    }

    if (!from_address || !isValidXRPLAddress(from_address as string)) {
      return jsonError('Invalid sender address', 400);
    }

    if (!to_address || !isValidXRPLAddress(to_address as string)) {
      return jsonError('Invalid destination address', 400);
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

    if (from_address === to_address) return jsonError('Cannot send to yourself', 400);

    // --- Wallet ownership ---
    const { data: walletLink } = await supabase
      .from('user_wallets')
      .select('id')
      .eq('wallet_address', from_address)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!walletLink) return jsonError('Wallet not linked to your account. Please connect it first.', 403);

    // Fetch account info and server state in parallel (with failover nodes)
    const [accountInfoRes, serverInfoRes] = await Promise.all([
      xrplRequest(nodes, 'account_info', [{ account: from_address, ledger_index: 'validated' }]),
      xrplRequest(nodes, 'server_info', [{}]),
    ]);

    if (accountInfoRes.result?.error === 'actNotFound') {
      return jsonError('Sender account not found on XRPL', 400);
    }

    const accountData = accountInfoRes.result?.account_data;
    if (!accountData) return jsonError('Could not fetch account data', 500);

    const balanceXrp = Number(accountData.Balance) / 1_000_000;
    const ownerCount = accountData.OwnerCount || 0;

    // Use current post-amendment reserves (1 XRP base, 0.2 XRP per owner object)
    const reserveBase = 1;
    const reserveInc = 0.2;
    const totalReserve = reserveBase + (ownerCount * reserveInc);
    const spendable = balanceXrp - totalReserve;

    if (amount > spendable) {
      return jsonError(
        `Insufficient spendable balance. You have ${spendable.toFixed(6)} XRP available (${totalReserve} XRP reserved).`,
        400,
      );
    }

    // Get current ledger index for LastLedgerSequence
    const validatedLedger = serverInfoRes.result?.info?.validated_ledger?.seq || 0;
    const lastLedgerSequence = validatedLedger + 30;

    const feeDrops = "12";
    const drops = String(Math.round(amount * 1_000_000));

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
