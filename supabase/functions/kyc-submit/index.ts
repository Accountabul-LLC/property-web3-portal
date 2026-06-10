import { createCorsHeaders } from '../_shared/cors.ts';
import { safeErrorMessage } from "../_shared/errors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const REQUIRED_FIELDS = [
  'legal_first_name',
  'legal_last_name',
  'date_of_birth',
  'nationality',
  'country_of_residence',
  'address_line1',
  'city',
  'postal_code',
  'country',
  'source_of_funds',
]

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));
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

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the case
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

    if (kycCase.status !== 'in_progress') {
      return new Response(JSON.stringify({
        error: `Cannot submit from status: ${kycCase.status}`,
        current_status: kycCase.status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Validate all required fields are present
    const { data: formData, error: formError } = await serviceClient
      .from('kyc_form_data')
      .select('*')
      .eq('kyc_case_id', kycCase.id)
      .maybeSingle()

    if (formError) throw formError

    const missingFields: string[] = []
    for (const field of REQUIRED_FIELDS) {
      const value = formData?.[field]
      if (typeof value !== 'string' || value.trim().length === 0) {
        missingFields.push(field)
      }
    }

    if (missingFields.length > 0) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        missing_fields: missingFields,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const now = new Date().toISOString()

    // Transition to submitted
    const { error: updateError } = await serviceClient
      .from('kyc_cases')
      .update({
        status: 'submitted',
        submitted_at: now,
        updated_at: now,
      })
      .eq('id', kycCase.id)

    if (updateError) throw updateError

    // Record history
    await serviceClient.from('kyc_status_history').insert({
      kyc_case_id: kycCase.id,
      from_status: 'in_progress',
      to_status: 'submitted',
      actor_id: user.id,
      actor_role: 'user',
      reason: 'User submitted KYC application',
      metadata: { submitted_at: now },
    })

    return new Response(JSON.stringify({
      kyc_case_id: kycCase.id,
      status: 'submitted',
      submitted_at: now,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in kyc-submit:', error)
    return new Response(JSON.stringify({ error: safeErrorMessage(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
