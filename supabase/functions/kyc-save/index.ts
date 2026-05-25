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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const body = await req.json()
    const {
      legal_first_name, legal_last_name, date_of_birth,
      nationality, country_of_residence,
      address_line1, address_line2, city, state, postal_code, country,
      source_of_funds,
    } = body

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the case belongs to this user and is editable
    const { data: kycCase, error: caseError } = await serviceClient
      .from('kyc_cases')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (caseError) throw caseError

    if (!kycCase) {
      return new Response(JSON.stringify({ error: 'No KYC case found. Call kyc-start first.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (!['in_progress', 'rejected'].includes(kycCase.status)) {
      return new Response(JSON.stringify({ error: `Cannot edit form in status: ${kycCase.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Upsert form data
    const { error: upsertError } = await serviceClient
      .from('kyc_form_data')
      .upsert({
        kyc_case_id: kycCase.id,
        legal_first_name: legal_first_name ?? null,
        legal_last_name: legal_last_name ?? null,
        date_of_birth: date_of_birth ?? null,
        nationality: nationality ?? null,
        country_of_residence: country_of_residence ?? null,
        address_line1: address_line1 ?? null,
        address_line2: address_line2 ?? null,
        city: city ?? null,
        state: state ?? null,
        postal_code: postal_code ?? null,
        country: country ?? null,
        source_of_funds: source_of_funds ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'kyc_case_id' })

    if (upsertError) {
      console.error('Error upserting form data:', upsertError)
      throw upsertError
    }

    // If case was rejected, transition back to in_progress on re-edit
    if (kycCase.status === 'rejected') {
      await serviceClient
        .from('kyc_cases')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', kycCase.id)

      await serviceClient.from('kyc_status_history').insert({
        kyc_case_id: kycCase.id,
        from_status: 'rejected',
        to_status: 'in_progress',
        actor_id: user.id,
        actor_role: 'user',
        reason: 'User restarted KYC after rejection',
      })
    }

    return new Response(JSON.stringify({ kyc_case_id: kycCase.id, saved: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in kyc-save:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
