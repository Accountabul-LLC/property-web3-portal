import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY');
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!xamanApiKey || !xamanApiSecret) {
      throw new Error('Xaman API credentials not configured');
    }

    const { tx_json } = await req.json();

    if (!tx_json || !tx_json.TransactionType) {
      throw new Error('Invalid transaction JSON');
    }

    const senderAddress = tx_json.Account;
    console.log('Creating Xaman payment payload for', senderAddress, '→', tx_json.Destination);

    // Look up the user_token for push notifications
    let userToken: string | null = null;
    if (senderAddress) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: profile } = await supabase
        .from('wallet_profiles')
        .select('xaman_user_token')
        .eq('wallet_address', senderAddress)
        .single();
      userToken = profile?.xaman_user_token || null;
    }

    console.log('User token present:', !!userToken);

    const payload: Record<string, unknown> = {
      txjson: tx_json,
      options: {
        submit: true,
        expire: 300,
        return_url: {
          web: `${req.headers.get('origin') || ''}`
        }
      },
      custom_meta: {
        identifier: `payment_${Date.now()}`,
        blob: {
          purpose: 'PAYMENT',
          created: new Date().toISOString()
        }
      }
    };

    // Include user_token to trigger push notification instead of QR code
    if (userToken) {
      payload.user_token = userToken;
    }

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
      throw new Error(`Xaman API error: ${xamanResponse.status}`);
    }

    const xamanData = JSON.parse(responseText);
    console.log('Xaman payment payload created:', xamanData.uuid, 'pushed:', xamanData.pushed);

    return new Response(JSON.stringify({
      success: true,
      uuid: xamanData.uuid,
      qr_code: xamanData.refs?.qr_png,
      websocket_url: xamanData.refs?.websocket_status,
      pushed: xamanData.pushed || false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in xaman-send-payment:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
