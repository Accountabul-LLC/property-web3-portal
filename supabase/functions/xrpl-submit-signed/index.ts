import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: verify JWT and extract user ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    // SEC-014: Server-side KYC enforcement — never trust the React client gate alone
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: kycStatus, error: kycError } = await supabaseAdmin.rpc('get_kyc_status', { p_user_id: userId });
    if (kycError) {
      return new Response(JSON.stringify({ success: false, error: 'Unable to verify identity status' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (kycStatus !== 'approved') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Identity verification required',
        kyc_status: kycStatus,
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tx_json, wallet_address, network } = await req.json();

    if (network !== 'testnet' && network !== 'devnet') {
      throw new Error('Server-side signing is only supported on testnet and devnet');
    }

    if (!tx_json || !wallet_address) {
      throw new Error('Missing tx_json or wallet_address');
    }

    const nodes = network === 'devnet' ? DEVNET_NODES : TESTNET_NODES;

    // Ownership check: wallet must belong to the authenticated user
    const { data: walletRow, error: walletError } = await supabaseAdmin
      .from('user_wallets')
      .select('wallet_secret, provider')
      .eq('wallet_address', wallet_address)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (walletError || !walletRow) {
      throw new Error('Wallet not found');
    }

    if (walletRow.provider !== 'testnet_faucet' || !walletRow.wallet_secret) {
      throw new Error('This wallet does not support server-side signing');
    }

    const { Wallet } = await import('npm:xrpl@3.1.0');
    
    const wallet = Wallet.fromSeed(walletRow.wallet_secret);
    console.log('Derived wallet address:', wallet.address);

    // Get account info for sequence with failover
    const accountInfo = await xrplRequest(nodes, 'account_info', [{ account: wallet_address, ledger_index: 'current' }]);

    if (accountInfo.result?.error) {
      throw new Error(`Account error: ${accountInfo.result.error_message || accountInfo.result.error}`);
    }

    const sequence = accountInfo.result?.account_data?.Sequence;
    if (sequence === undefined) {
      throw new Error('Could not determine account sequence');
    }

    const completeTx = {
      ...tx_json,
      Sequence: tx_json.Sequence ?? sequence,
    };

    console.log('Signing tx:', JSON.stringify(completeTx));

    const signed = wallet.sign(completeTx);
    console.log('Signed, hash:', signed.hash, 'blob length:', signed.tx_blob.length);

    // Submit with failover
    const submitData = await xrplRequest(nodes, 'submit', [{ tx_blob: signed.tx_blob }]);
    console.log('Submit response:', JSON.stringify(submitData));

    const engineResult = submitData.result?.engine_result;
    const txHash = submitData.result?.tx_json?.hash || signed.hash;

    if (engineResult !== 'tesSUCCESS' && !engineResult?.startsWith('tec')) {
      throw new Error(`Submit failed: ${engineResult} — ${submitData.result?.engine_result_message || ''}`);
    }

    return new Response(JSON.stringify({
      success: true,
      tx_hash: txHash,
      engine_result: engineResult,
      engine_result_message: submitData.result?.engine_result_message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Submit signed error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
