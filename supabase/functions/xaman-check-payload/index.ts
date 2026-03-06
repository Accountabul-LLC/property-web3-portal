import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

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
      return new Response(
        JSON.stringify({ success: false, error: 'UUID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY');
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET');

    if (!xamanApiKey || !xamanApiSecret) {
      throw new Error('Xaman API credentials not configured');
    }

    // Authenticate the calling user (optional — wallet connect requires auth)
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (!claimsError && claimsData?.claims?.sub) {
        userId = claimsData.claims.sub as string;
      }
    }

    console.log('Checking Xaman payload status:', uuid, 'userId:', userId);

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

    // Use service role for DB writes (user_wallets RLS requires user_id match)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let status = 'pending';
    let wallet_address = null;
    let account_name: string | null = null;

    if (xamanData.meta?.signed && xamanData.response) {
      status = 'signed';
      wallet_address = xamanData.response.account;
      const userToken = xamanData.response?.user_token || null;
      // Extract tx hash: Xaman returns it as `txid` for payment payloads
      const txHash = xamanData.response?.txid || xamanData.response?.hash || null;
      
      console.log('Wallet signed in:', wallet_address, 'txid:', txHash, 'user_token present:', !!userToken);

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

      // Backward compat: update wallet_profiles
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

      // Link wallet to authenticated user in user_wallets
      if (userId) {
        // Check if wallet is already linked to a DIFFERENT user
        const { data: existingLink } = await supabase
          .from('user_wallets')
          .select('user_id')
          .eq('wallet_address', wallet_address)
          .eq('status', 'active')
          .single();

        if (existingLink && existingLink.user_id !== userId) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'This wallet is already linked to another account. Please disconnect it from the other account first.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Upsert the wallet link
        await supabase
          .from('user_wallets')
          .upsert({
            user_id: userId,
            wallet_address,
            xaman_account_name: account_name,
            xaman_user_token: userToken,
            label: account_name || 'Wallet',
            provider: 'xaman',
            status: 'active',
            last_seen_at: new Date().toISOString(),
            revoked_at: null,
          }, { onConflict: 'wallet_address' });

        console.log('Linked wallet', wallet_address, 'to user', userId);
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

    // Build response — include tx_hash for payment payloads
    const txHashFromSigning = xamanData.response?.txid || xamanData.response?.hash || null;

    return new Response(
      JSON.stringify({
        success: true,
        status,
        signed: xamanData.meta?.signed || false,
        wallet_address,
        account_name,
        tx_hash: txHashFromSigning,
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
