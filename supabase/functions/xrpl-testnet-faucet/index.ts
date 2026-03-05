const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Call XRPL testnet faucet
    const faucetRes = await fetch('https://faucet.altnet.rippletest.net/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!faucetRes.ok) {
      const text = await faucetRes.text();
      console.error('Faucet error:', faucetRes.status, text);
      throw new Error(`Faucet returned ${faucetRes.status}`);
    }

    const data = await faucetRes.json();
    console.log('Faucet response:', JSON.stringify(data));

    // The faucet returns: { account: { address, secret }, amount, balance }
    const address = data.account?.address || data.account?.classicAddress;
    const balance = data.balance || data.amount;

    if (!address) {
      throw new Error('Faucet did not return an address');
    }

    const secret = data.account?.secret;

    return new Response(JSON.stringify({
      success: true,
      address,
      balance,
      secret,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Testnet faucet error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
