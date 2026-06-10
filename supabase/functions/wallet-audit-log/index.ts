import { safeErrorMessage } from "../_shared/errors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireEdgeUser } from "../_shared/auth.ts";

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com)$/i.test(origin)
    || origin === (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app'),
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Vary': 'Origin',
  };
}

async function hashIpHint(ipHint: string | null): Promise<string | null> {
  if (!ipHint) return null;
  const salt = Deno.env.get('WALLET_AUDIT_LOG_IP_SALT') || Deno.env.get('APP_URL') || 'accountabul-wallet-audit-log';
  const input = `${salt}:${ipHint.trim()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return `sha256:${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, event_type, metadata } = await req.json();

    if (!wallet_address || typeof wallet_address !== 'string') {
      return new Response(JSON.stringify({ error: 'wallet_address required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validEvents = ['connect', 'disconnect', 'switch_to', 'switch_from', 'disconnect_all'];
    if (!event_type || !validEvents.includes(event_type)) {
      return new Response(JSON.stringify({ error: `event_type must be one of: ${validEvents.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const auth = await requireEdgeUser(req, corsHeaders);
    if (auth instanceof Response) return auth;
    const { user } = auth;

    // Extract client info from headers
    const userAgent = req.headers.get('user-agent') || null;
    const ipHint = await hashIpHint(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null);

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: walletOwner, error: ownerError } = await supabase
      .from('user_wallets')
      .select('id')
      .eq('wallet_address', wallet_address)
      .eq('user_id', user.id)
      .maybeSingle();

    if (ownerError) throw ownerError;
    if (!walletOwner) {
      return new Response(JSON.stringify({ error: 'Wallet not owned by authenticated user' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase.from('wallet_audit_log').insert({
      wallet_address,
      event_type,
      metadata: metadata || {},
      ip_hint: ipHint,
      user_agent: userAgent,
      user_id: user.id,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Wallet audit log error:', error);
    return new Response(JSON.stringify({ error: safeErrorMessage(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
