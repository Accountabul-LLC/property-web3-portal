import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deriveKeypair, sign } from 'https://esm.sh/ripple-keypairs@2.0.0';
import { encode, encodeForSigning } from 'https://esm.sh/ripple-binary-codec@2.1.0';
import { createHash } from 'https://deno.land/std@0.224.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TESTNET_RPC = 'https://s.altnet.rippletest.net:51234';

function computeTxHash(txBlob: string): string {
  // XRPL tx hash = SHA-512Half of (0x54584E00 + serialized tx)
  const prefix = '54584E00';
  const data = new Uint8Array(
    (prefix + txBlob).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  const hashBuffer = new Uint8Array(64);
  const hash = new Uint8Array(
    crypto.subtle ? [] : [] // We'll use a simpler approach
  );
  // Use Web Crypto API
  return ''; // Will compute after submit from response
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

    // Derive keypair from seed
    const keypair = deriveKeypair(secret);
    console.log('Derived public key:', keypair.publicKey);

    // Get account sequence from ledger
    const accountInfoRes = await fetch(TESTNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'account_info',
        params: [{ account: wallet_address, ledger_index: 'current' }],
      }),
    });
    const accountInfo = await accountInfoRes.json();

    if (accountInfo.result?.error) {
      throw new Error(`Account error: ${accountInfo.result.error_message || accountInfo.result.error}`);
    }

    const sequence = accountInfo.result?.account_data?.Sequence;
    if (sequence === undefined) {
      throw new Error('Could not determine account sequence');
    }

    // Complete the transaction
    const completeTx = {
      ...tx_json,
      Sequence: tx_json.Sequence ?? sequence,
      SigningPubKey: keypair.publicKey,
    };

    console.log('Complete tx:', JSON.stringify(completeTx));

    // Serialize for signing
    const serializedForSigning = encodeForSigning(completeTx);

    // Sign the serialized transaction
    const signature = sign(serializedForSigning, keypair.privateKey);

    // Add signature to tx and encode final blob
    const signedTx = {
      ...completeTx,
      TxnSignature: signature,
    };
    const txBlob = encode(signedTx);

    console.log('Signed tx blob length:', txBlob.length);

    // Submit the signed transaction
    const submitRes = await fetch(TESTNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'submit',
        params: [{ tx_blob: txBlob }],
      }),
    });

    const submitData = await submitRes.json();
    console.log('Submit response:', JSON.stringify(submitData));

    const engineResult = submitData.result?.engine_result;
    const txHash = submitData.result?.tx_json?.hash;

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
