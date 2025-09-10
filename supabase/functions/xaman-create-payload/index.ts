import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY')!;

    console.log('Creating Xaman payload for sign-in');

    // Create sign-in payload for Xaman
    const payload = {
      txjson: {
        TransactionType: 'SignIn'
      },
      options: {
        submit: false,
        expire: 300, // 5 minutes
        return_url: {
          web: `${req.url.split('/functions/')[0]}`
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

    console.log('Sending payload to Xaman API');

    const xamanResponse = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${xamanApiKey}`,
        'X-API-Key': xamanApiKey
      },
      body: JSON.stringify(payload)
    });

    if (!xamanResponse.ok) {
      const errorText = await xamanResponse.text();
      console.error('Xaman API error:', errorText);
      throw new Error(`Xaman API error: ${xamanResponse.status} - ${errorText}`);
    }

    const xamanData: XamanPayloadResponse = await xamanResponse.json();
    console.log('Xaman payload created:', xamanData.uuid);

    // Store payload reference in Supabase for tracking
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