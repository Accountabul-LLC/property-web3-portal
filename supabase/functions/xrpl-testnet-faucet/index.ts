import { safeErrorMessage } from "../_shared/errors.ts";
import { parseJsonBody } from "../_shared/auth.ts";

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

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
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
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.4')
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
    if (req.body) {
      const body = await parseJsonBody<{ destination?: unknown }>(req, corsHeaders);
      if (body instanceof Response) return body;
      destination = typeof body.destination === 'string' ? body.destination : undefined;
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
    console.log('Faucet response:', JSON.stringify({
      address: data.account?.address || data.account?.classicAddress,
      balance: data.balance || data.amount,
    }));

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
      error: safeErrorMessage(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
