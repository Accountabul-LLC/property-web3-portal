import { createCorsHeaders } from '../_shared/cors.ts';
import { safeErrorMessage } from "../_shared/errors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { requireEdgeUser } from '../_shared/auth.ts';
import { parseJsonBody } from '../_shared/auth.ts';
import { requireKyc } from '../_shared/require-kyc.ts';




function getAppOrigin(): string {
  return Deno.env.get('APP_URL') || Deno.env.get('APP_ALLOWED_ORIGIN') || 'https://accountabul.com';
}

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY');
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET');
    if (!xamanApiKey || !xamanApiSecret) {
      throw new Error('Xaman API credentials not configured');
    }

    const auth = await requireEdgeUser(req, corsHeaders);
    if (auth instanceof Response) return auth;
    const { user } = auth;

    // SEC-014: hard KYC gate. Admins bypass; everyone else must be 'approved'.
    const kycGate = await requireKyc(user.id, corsHeaders);
    if (kycGate instanceof Response) return kycGate;

    const body = await parseJsonBody<{ tx_json?: Record<string, unknown> }>(req, corsHeaders);
    if (body instanceof Response) return body;
    const { tx_json } = body;

    if (!tx_json || !tx_json.TransactionType) {
      throw new Error('Invalid transaction JSON');
    }

    const senderAddress = tx_json.Account;
    console.log('Creating Xaman payment payload for', senderAddress, '→', tx_json.Destination);

    // Look up the user_token for push notifications from the canonical wallet table.
    let userToken: string | null = null;
    if (senderAddress) {
      const supabase = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('xaman_user_token')
        .eq('wallet_address', senderAddress)
        .eq('status', 'active')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!wallet) {
        return new Response(JSON.stringify({
          success: false,
          error: 'The sender wallet is not linked to your account.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }
      userToken = wallet.xaman_user_token || null;
    }

    console.log('User token present:', !!userToken);

    const payload: Record<string, unknown> = {
      txjson: tx_json,
      options: {
        submit: true,
        expire: 300,
        return_url: {
          web: getAppOrigin()
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
      error: safeErrorMessage(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
