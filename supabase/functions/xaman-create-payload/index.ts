import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

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
}interface XamanPayloadResponse {
  uuid: string;
  next: {
    always: string;
  };
  refs: {
    qr_png: string;
    qr_matrix: string;
    qr_uri_quality_opts: string[];
    websocket_status: string;
  };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY');
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET');

    if (!xamanApiKey || !xamanApiSecret) {
      console.error('Missing XAMAN_API_KEY or XAMAN_API_SECRET');
      throw new Error('Xaman API credentials not configured');
    }

    // Require auth so anonymous callers cannot create or persist payload rows.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user?.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // SEC-004: Bind payloads to the signed-in caller.
    // This prevents an attacker from submitting another user's signed QR response under their own auth token.
    const intendedUserId = user.id;

    const { network } = await req.json().catch(() => ({ network: undefined }));
    const resolvedNetwork = network || 'mainnet';

    const payload = {
      txjson: {
        TransactionType: 'SignIn'
      },
      options: {
        submit: false,
        expire: 300,
        return_url: {
          // SEC-016: Use env-configured URL — never trust the Origin header for redirects
          web: Deno.env.get('APP_URL') || 'https://accountabul.com',
        }
      },
      custom_meta: {
        identifier: `signin_${Date.now()}`,
        blob: JSON.stringify({
          purpose: 'SIGN_IN',
          network: resolvedNetwork,
          created: new Date().toISOString()
        })
      }
    };

    console.log('Sending payload to Xaman API...');

    const xamanResponse = await fetch('https://xaman.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': xamanApiKey,
        'X-API-Secret': xamanApiSecret,
      },
      body: JSON.stringify(payload)
    });

    const responseText = await xamanResponse.text();

    if (!xamanResponse.ok) {
      console.error('Xaman API error:', xamanResponse.status, responseText);
      throw new Error(`Xaman API error: ${xamanResponse.status} - ${responseText}`);
    }

    let xamanData: XamanPayloadResponse;
    try {
      xamanData = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Xaman response:', responseText.substring(0, 200));
      throw new Error('Invalid response from Xaman API');
    }

    console.log('Xaman payload created:', xamanData.uuid);

    // Store payload with intended_user_id binding (SEC-004)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error: dbError } = await supabase
      .from('xaman_payloads')
      .insert({
        uuid: xamanData.uuid,
        status: 'pending',
        intended_user_id: intendedUserId,
        network: resolvedNetwork,
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Database error storing payload:', dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        uuid: xamanData.uuid,
        qr_code: xamanData.refs.qr_png,
        websocket_url: xamanData.refs.websocket_status
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in xaman-create-payload:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
