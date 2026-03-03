import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
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

    // Extract client info from headers
    const userAgent = req.headers.get('user-agent') || null;
    const ipHint = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from('wallet_audit_log').insert({
      wallet_address,
      event_type,
      metadata: metadata || {},
      ip_hint: ipHint,
      user_agent: userAgent,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Wallet audit log error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
