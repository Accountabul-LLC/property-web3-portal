import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse optional destination from body (fund existing account)
    let destination: string | undefined;
    try {
      const body = await req.json();
      destination = body?.destination;
    } catch {
      // No body or invalid JSON — create new account
    }

    const faucetBody: Record<string, unknown> = {};
    if (destination) {
      faucetBody.destination = destination;
    }

    // Call XRPL testnet faucet
    const faucetRes = await fetch('https://faucet.altnet.rippletest.net/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(faucetBody),
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

    const secret = data.account?.secret || data.seed;

    return new Response(JSON.stringify({
      success: true,
      address,
      balance,
      secret,
      funded_existing: !!destination,
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
