/**
 * stripe-identity-webhook
 *
 * Receives Stripe Identity webhook events and updates the linked kyc_cases row.
 * Maps Stripe statuses to internal kyc statuses:
 *   verified         -> under_review  (admin still does final approval)
 *   requires_input   -> in_progress
 *   processing       -> submitted
 *   canceled         -> in_progress
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
    const WEBHOOK_SECRET = Deno.env.get('STRIPE_IDENTITY_WEBHOOK_SECRET')
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' })

    const signature = req.headers.get('stripe-signature')
    const rawBody = await req.text()

    let event: Stripe.Event
    if (WEBHOOK_SECRET && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(rawBody, signature, WEBHOOK_SECRET)
      } catch (err) {
        console.error('Webhook signature verification failed:', (err as Error).message)
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Dev fallback when webhook secret isn't configured yet
      console.warn('STRIPE_IDENTITY_WEBHOOK_SECRET not set — accepting unverified webhook')
      event = JSON.parse(rawBody) as Stripe.Event
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (!event.type.startsWith('identity.verification_session.')) {
      return new Response(JSON.stringify({ received: true, ignored: event.type }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const session = event.data.object as Stripe.Identity.VerificationSession
    const kycCaseId = (session.metadata as Record<string, string> | null)?.kyc_case_id
    if (!kycCaseId) {
      console.warn('Webhook missing kyc_case_id metadata', session.id)
      return new Response(JSON.stringify({ received: true, warning: 'no metadata' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Map Stripe status -> internal kyc status
    let internalStatus: string | null = null
    let rejection: string | null = null
    switch (session.status) {
      case 'verified':
        internalStatus = 'under_review'
        break
      case 'processing':
        internalStatus = 'submitted'
        break
      case 'requires_input':
        internalStatus = 'in_progress'
        rejection = session.last_error?.reason ?? null
        break
      case 'canceled':
        internalStatus = 'in_progress'
        break
    }

    const update: Record<string, unknown> = {
      stripe_verification_status: session.status,
      stripe_last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (internalStatus) update.status = internalStatus
    if (internalStatus === 'under_review' || internalStatus === 'submitted') {
      update.submitted_at = new Date().toISOString()
    }
    if (rejection) update.rejection_reason = rejection

    const { data: current } = await svc
      .from('kyc_cases')
      .select('status')
      .eq('id', kycCaseId)
      .maybeSingle()

    await svc.from('kyc_cases').update(update).eq('id', kycCaseId)

    if (internalStatus && current?.status !== internalStatus) {
      await svc.from('kyc_status_history').insert({
        kyc_case_id: kycCaseId,
        from_status: current?.status ?? null,
        to_status: internalStatus,
        actor_role: 'stripe_identity',
        reason: `Stripe ${event.type} (${session.status})`,
        metadata: { stripe_event_id: event.id, stripe_session_id: session.id },
      })
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('stripe-identity-webhook error', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
