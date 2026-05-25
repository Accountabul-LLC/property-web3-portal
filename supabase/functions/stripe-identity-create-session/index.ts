/**
 * stripe-identity-create-session
 *
 * Creates (or returns existing) a Stripe Identity VerificationSession for the
 * authenticated user, links it to their kyc_cases row, and returns the
 * hosted verification URL + client_secret for the frontend to redirect to.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

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
}Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anon = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: authErr } = await anon.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const svc = createClient(supabaseUrl, serviceKey)

    // Ensure a kyc_cases row exists
    let { data: kycCase } = await svc
      .from('kyc_cases')
      .select('id, status, stripe_verification_session_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!kycCase) {
      const { data: created, error: insErr } = await svc
        .from('kyc_cases')
        .insert({ user_id: user.id, status: 'in_progress' })
        .select('id, status, stripe_verification_session_id')
        .single()
      if (insErr) throw insErr
      kycCase = created
    }

    // If a verification session already exists, retrieve it and reuse if still usable
    if (kycCase.stripe_verification_session_id) {
      const existingRes = await fetch(
        `https://api.stripe.com/v1/identity/verification_sessions/${kycCase.stripe_verification_session_id}`,
        { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
      )
      const existing = await existingRes.json()
      if (existingRes.ok && existing.status === 'requires_input' && existing.url) {
        return new Response(JSON.stringify({
          verification_session_id: existing.id,
          client_secret: existing.client_secret,
          url: existing.url,
          status: existing.status,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      // else fall through to create a new one
    }

    // Determine app return URL (prefer caller origin so test/live previews work)
    const origin = req.headers.get('origin') ?? ''
    const returnUrl = origin
      ? `${origin}/kyc/status?stripe_check=1`
      : 'https://accountabul.lovable.app/kyc/status?stripe_check=1'

    const body = new URLSearchParams()
    body.append('type', 'document')
    body.append('options[document][require_matching_selfie]', 'true')
    body.append('options[document][require_live_capture]', 'true')
    body.append('options[document][require_id_number]', 'false')
    body.append('metadata[user_id]', user.id)
    body.append('metadata[kyc_case_id]', kycCase.id)
    body.append('return_url', returnUrl)

    const createRes = await fetch('https://api.stripe.com/v1/identity/verification_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const session = await createRes.json()
    if (!createRes.ok) {
      console.error('Stripe create error:', session)
      return new Response(JSON.stringify({ error: session?.error?.message ?? 'Stripe error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await svc.from('kyc_cases').update({
      stripe_verification_session_id: session.id,
      stripe_verification_status: session.status,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    }).eq('id', kycCase.id)

    return new Response(JSON.stringify({
      verification_session_id: session.id,
      client_secret: session.client_secret,
      url: session.url,
      status: session.status,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('stripe-identity-create-session error', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
