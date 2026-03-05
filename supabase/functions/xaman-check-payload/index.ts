import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { uuid } = await req.json();
    
    if (!uuid) {
      throw new Error('UUID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY');
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET');

    if (!xamanApiKey || !xamanApiSecret) {
      throw new Error('Xaman API credentials not configured');
    }

    console.log('Checking Xaman payload status:', uuid);

    const xamanResponse = await fetch(`https://xaman.app/api/v1/platform/payload/${uuid}`, {
      method: 'GET',
      headers: {
        'X-API-Key': xamanApiKey,
        'X-API-Secret': xamanApiSecret,
      }
    });

    const responseText = await xamanResponse.text();

    if (!xamanResponse.ok) {
      console.error('Xaman API error:', xamanResponse.status, responseText);
      throw new Error(`Xaman API error: ${xamanResponse.status}`);
    }

    let xamanData: any;
    try {
      xamanData = JSON.parse(responseText);
    } catch {
      throw new Error('Invalid response from Xaman API');
    }

    console.log('Payload status - signed:', xamanData.meta?.signed, 'cancelled:', xamanData.meta?.cancelled, 'expired:', xamanData.meta?.expired);

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let status = 'pending';
    let wallet_address = null;

    if (xamanData.meta?.signed && xamanData.response) {
      status = 'signed';
      wallet_address = xamanData.response.account;
      const userToken = xamanData.response?.user_token || null;
      
      console.log('Wallet signed in:', wallet_address, 'user_token present:', !!userToken);

      await supabase
        .from('xaman_payloads')
        .update({
          status: 'signed',
          wallet_address,
          signed_at: new Date().toISOString()
        })
        .eq('uuid', uuid);

      // Create or update user profile (including user_token for push notifications)
      const { data: existingProfile } = await supabase
        .from('wallet_profiles')
        .select('*')
        .eq('wallet_address', wallet_address)
        .single();

      if (!existingProfile) {
        await supabase
          .from('wallet_profiles')
          .insert({
            wallet_address,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            xaman_user_token: userToken,
          });
      } else {
        const updateData: Record<string, unknown> = { last_login: new Date().toISOString() };
        if (userToken) updateData.xaman_user_token = userToken;
        await supabase
          .from('wallet_profiles')
          .update(updateData)
          .eq('wallet_address', wallet_address);
      }

    } else if (xamanData.meta?.cancelled) {
      status = 'cancelled';
      await supabase
        .from('xaman_payloads')
        .update({ status: 'cancelled' })
        .eq('uuid', uuid);
    } else if (xamanData.meta?.expired) {
      status = 'expired';
      await supabase
        .from('xaman_payloads')
        .update({ status: 'expired' })
        .eq('uuid', uuid);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status,
        signed: xamanData.meta?.signed || false,
        wallet_address,
        expired: xamanData.meta?.expired || false,
        cancelled: xamanData.meta?.cancelled || false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in xaman-check-payload:', error);
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
