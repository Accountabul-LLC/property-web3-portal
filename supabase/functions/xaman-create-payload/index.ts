import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

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

    console.log('Creating Xaman payload for sign-in');
    console.log('API Key present:', !!xamanApiKey, 'Secret present:', !!xamanApiSecret);

    const payload = {
      txjson: {
        TransactionType: 'SignIn'
      },
      options: {
        submit: false,
        expire: 300,
        return_url: {
          web: `${req.headers.get('origin') || req.url.split('/functions/')[0]}`
        }
      },
      custom_meta: {
        identifier: `signin_${Date.now()}`,
        blob: {
          purpose: 'SIGN_IN',
          created: new Date().toISOString()
        }
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

    // Store payload reference in database
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { error: dbError } = await supabase
      .from('xaman_payloads')
      .insert({
        uuid: xamanData.uuid,
        status: 'pending',
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
