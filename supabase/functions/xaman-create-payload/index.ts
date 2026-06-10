import { createCorsHeaders } from '../_shared/cors.ts';
import { safeErrorMessage } from "../_shared/errors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { parseJsonBody, requireEdgeUser } from '../_shared/auth.ts'



interface XamanPayloadResponse {
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
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY');
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET');

    if (!supabaseServiceKey) {
      throw new Error('Supabase service role key not configured');
    }

    if (!xamanApiKey || !xamanApiSecret) {
      console.error('Missing XAMAN_API_KEY or XAMAN_API_SECRET');
      throw new Error('Xaman API credentials not configured');
    }

    const auth = await requireEdgeUser(req, corsHeaders);
    if (auth instanceof Response) return auth;
    const { user } = auth;

    // SEC-004: Bind payloads to the signed-in caller.
    // This prevents an attacker from submitting another user's signed QR response under their own auth token.
    const intendedUserId = user.id;

    let network: unknown = undefined;
    if (req.body) {
      const body = await parseJsonBody<{ network?: unknown }>(req, corsHeaders);
      if (body instanceof Response) return body;
      network = body.network;
    }
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
        error: safeErrorMessage(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
