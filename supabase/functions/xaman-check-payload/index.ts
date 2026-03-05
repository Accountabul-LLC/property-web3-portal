import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Try to resolve a human-readable account name from xrpscan (free, no key)
async function resolveAccountName(address: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.xrpscan.com/api/v1/account/${address}/name`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.name || data?.username || null;
  } catch {
    return null;
  }
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
    let account_name: string | null = null;

    if (xamanData.meta?.signed && xamanData.response) {
      status = 'signed';
      wallet_address = xamanData.response.account;
      const userToken = xamanData.response?.user_token || null;
      
      console.log('Wallet signed in:', wallet_address, 'user_token present:', !!userToken);

      // Resolve account name from xrpscan (non-blocking, best-effort)
      account_name = await resolveAccountName(wallet_address);
      console.log('Resolved account name:', account_name);

      await supabase
        .from('xaman_payloads')
        .update({
          status: 'signed',
          wallet_address,
          signed_at: new Date().toISOString()
        })
        .eq('uuid', uuid);

      // Create or update user profile (including user_token and account name)
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
            xaman_account_name: account_name,
          });
      } else {
        const updateData: Record<string, unknown> = { last_login: new Date().toISOString() };
        if (userToken) updateData.xaman_user_token = userToken;
        if (account_name) updateData.xaman_account_name = account_name;
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
        account_name,
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
