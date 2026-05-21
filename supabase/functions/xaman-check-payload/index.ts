import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

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
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
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

      // SEC-004: Link wallet to user — enforce intended_user_id binding
      if (userId) {
        // Verify the payload was created by this user (wallet-connect flow).
        // Prevents attacker from submitting another user's signed QR under their own token.
        const { data: payloadRow } = await supabase
          .from('xaman_payloads')
          .select('intended_user_id, network')
          .eq('uuid', uuid)
          .maybeSingle();

        const intendedUserId = payloadRow?.intended_user_id ?? null;
        if (intendedUserId && intendedUserId !== userId) {
          console.warn(`SEC-004 blocked: payload for ${intendedUserId}, caller is ${userId}`);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'This payload was not created by your session. Please initiate a new wallet connection.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          );
        }

        // Resolve network from stored payload (falls back to mainnet)
        const walletNetwork = payloadRow?.network || 'mainnet';

        // Check if wallet is already linked to a DIFFERENT user
        const { data: existingLink } = await supabase
          .from('user_wallets')
          .select('user_id')
          .eq('wallet_address', wallet_address)
          .eq('status', 'active')
          .maybeSingle();

        if (existingLink && existingLink.user_id !== userId) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'This wallet is already linked to another account. Please disconnect it from the other account first.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
          );
        }

        // Upsert the wallet link with the correct network
        await supabase
          .from('user_wallets')
          .upsert({
            user_id: userId,
            wallet_address,
            network: walletNetwork,
            xaman_account_name: account_name,
            xaman_user_token: userToken,
            label: account_name || 'Wallet',
            provider: 'xaman',
            status: 'active',
            last_seen_at: new Date().toISOString(),
            revoked_at: null,
          }, { onConflict: 'wallet_address' });

        console.log('Linked wallet', wallet_address, 'to user', userId, 'on network', walletNetwork);
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
