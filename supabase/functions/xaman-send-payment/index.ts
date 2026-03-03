const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY');
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET');

    if (!xamanApiKey || !xamanApiSecret) {
      throw new Error('Xaman API credentials not configured');
    }

    const { tx_json } = await req.json();

    if (!tx_json || tx_json.TransactionType !== 'Payment') {
      throw new Error('Invalid transaction JSON');
    }

    console.log('Creating Xaman payment payload for', tx_json.Account, '→', tx_json.Destination);

    const payload = {
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
    console.log('Xaman payment payload created:', xamanData.uuid);

    return new Response(JSON.stringify({
      success: true,
      uuid: xamanData.uuid,
      qr_code: xamanData.refs?.qr_png,
      websocket_url: xamanData.refs?.websocket_status,
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
