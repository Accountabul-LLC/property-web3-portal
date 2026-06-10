import { safeErrorMessage } from "../_shared/errors.ts";
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

    // Authenticate the user
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

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Check for existing case
    const { data: existingCase, error: fetchError } = await serviceClient
      .from('kyc_cases')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('Error fetching KYC case:', fetchError)
      throw fetchError
    }

    if (existingCase) {
      // Return existing case with form data
      const { data: formData } = await serviceClient
        .from('kyc_form_data')
        .select('*')
        .eq('kyc_case_id', existingCase.id)
        .maybeSingle()

      return new Response(JSON.stringify({
        kyc_case_id: existingCase.id,
        status: existingCase.status,
        form_data: formData ?? null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Create new KYC case
    const { data: newCase, error: insertError } = await serviceClient
      .from('kyc_cases')
      .insert({ user_id: user.id, status: 'in_progress' })
      .select('id, status')
      .single()

    if (insertError || !newCase) {
      console.error('Error creating KYC case:', insertError)
      throw insertError ?? new Error('Failed to create KYC case')
    }

    // Record history
    await serviceClient.from('kyc_status_history').insert({
      kyc_case_id: newCase.id,
      from_status: null,
      to_status: 'in_progress',
      actor_id: user.id,
      actor_role: 'user',
      reason: 'KYC case started',
    })

    return new Response(JSON.stringify({
      kyc_case_id: newCase.id,
      status: newCase.status,
      form_data: null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })
  } catch (error) {
    console.error('Error in kyc-start:', error)
    return new Response(JSON.stringify({ error: safeErrorMessage(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
