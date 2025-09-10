import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface XamanPayloadStatus {
  meta: {
    exists: boolean;
    uuid: string;
    multisign: boolean;
    submit: boolean;
    destination: string;
    resolved_destination: string;
    resolved: boolean;
    signed: boolean;
    cancelled: boolean;
    expired: boolean;
    pushed: boolean;
    app_opened: boolean;
    return_url_app: string | null;
    return_url_web: string | null;
  };
  application: {
    name: string;
    description: string;
    disabled: number;
    uuidv4: string;
    icon_url: string;
    issued_user_token: string | null;
  };
  payload: {
    tx_type: string;
    tx_destination: string;
    tx_destination_tag: number | null;
    request_json: object;
    created_at: string;
    expires_at: string;
    expires_in_seconds: number;
  };
  response?: {
    hex: string;
    txid: string;
    resolved_at: string;
    dispatched_to: string;
    dispatched_result: string;
    multisign_account: string | null;
    account: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { uuid } = await req.json();
    
    if (!uuid) {
      throw new Error('UUID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY')!;

    console.log('Checking Xaman payload status:', uuid);

    const xamanResponse = await fetch(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${xamanApiKey}`,
        'X-API-Key': xamanApiKey
      }
    });

    if (!xamanResponse.ok) {
      const errorText = await xamanResponse.text();
      console.error('Xaman API error:', errorText);
      throw new Error(`Xaman API error: ${xamanResponse.status}`);
    }

    const xamanData: XamanPayloadStatus = await xamanResponse.json();
    console.log('Payload status:', xamanData.meta.signed, xamanData.meta.cancelled, xamanData.meta.expired);

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let status = 'pending';
    let wallet_address = null;

    if (xamanData.meta.signed && xamanData.response) {
      status = 'signed';
      wallet_address = xamanData.response.account;
      
      console.log('Wallet signed in:', wallet_address);

      // Update payload status in database
      await supabase
        .from('xaman_payloads')
        .update({
          status: 'signed',
          wallet_address,
          signed_at: new Date().toISOString()
        })
        .eq('uuid', uuid);

      // Create or update user profile with wallet
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
            last_login: new Date().toISOString()
          });
      } else {
        await supabase
          .from('wallet_profiles')
          .update({
            last_login: new Date().toISOString()
          })
          .eq('wallet_address', wallet_address);
      }

    } else if (xamanData.meta.cancelled) {
      status = 'cancelled';
      await supabase
        .from('xaman_payloads')
        .update({ status: 'cancelled' })
        .eq('uuid', uuid);
    } else if (xamanData.meta.expired) {
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
        signed: xamanData.meta.signed,
        wallet_address,
        expired: xamanData.meta.expired,
        cancelled: xamanData.meta.cancelled
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