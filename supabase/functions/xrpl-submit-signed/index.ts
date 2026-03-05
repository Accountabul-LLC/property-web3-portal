import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TESTNET_RPC = 'https://s.altnet.rippletest.net:51234';

async function xrplRequest(method: string, params: Record<string, unknown>[]) {
  const res = await fetch(TESTNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tx_json, wallet_address, network } = await req.json();

    if (network !== 'testnet') {
      throw new Error('Server-side signing is only supported on testnet');
    }

    if (!tx_json || !wallet_address) {
      throw new Error('Missing tx_json or wallet_address');
    }

    // Look up the wallet secret using service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: walletRow, error: walletError } = await supabaseAdmin
      .from('user_wallets')
      .select('wallet_secret, provider')
      .eq('wallet_address', wallet_address)
      .eq('status', 'active')
      .single();

    if (walletError || !walletRow) {
      throw new Error('Wallet not found');
    }

    if (walletRow.provider !== 'testnet_faucet' || !walletRow.wallet_secret) {
      throw new Error('This wallet does not support server-side signing');
    }

    const secret = walletRow.wallet_secret;

    // Import xrpl.js dynamically via npm: specifier (Deno native)
    const { Wallet } = await import('npm:xrpl@4.1.0');
    
    // Derive wallet from seed
    const wallet = Wallet.fromSeed(secret);
    console.log('Derived wallet address:', wallet.address);

    // Get account info for sequence
    const accountInfo = await xrplRequest('account_info', [{ account: wallet_address, ledger_index: 'current' }]);

    if (accountInfo.result?.error) {
      throw new Error(`Account error: ${accountInfo.result.error_message || accountInfo.result.error}`);
    }

    const sequence = accountInfo.result?.account_data?.Sequence;
    if (sequence === undefined) {
      throw new Error('Could not determine account sequence');
    }

    // Complete the transaction with sequence and signing pub key
    const completeTx = {
      ...tx_json,
      Sequence: tx_json.Sequence ?? sequence,
    };

    console.log('Signing tx:', JSON.stringify(completeTx));

    // Sign locally
    const signed = wallet.sign(completeTx);
    console.log('Signed, hash:', signed.hash, 'blob length:', signed.tx_blob.length);

    // Submit
    const submitData = await xrplRequest('submit', [{ tx_blob: signed.tx_blob }]);
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
