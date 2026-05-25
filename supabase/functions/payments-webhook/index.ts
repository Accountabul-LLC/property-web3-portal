import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createCorsHeaders } from "../_shared/cors.ts";
import {
  isUuidLike,
  normalizeProvider,
  stripeEventId,
  stripeEventType,
  stripePaymentIdFromEvent,
  stripeProviderReferenceFromEvent,
  stripeWebhookSignatureValid,
} from "../_shared/payments.ts";

const json = (body: unknown, status = 200, corsHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safeJson = (raw: string) => {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const resolveGenericPaymentId = (payload: Record<string, any>) => {
  const candidates = [
    payload.payment_id,
    payload.paymentId,
    payload.invoice?.payment_id,
    payload.invoice?.paymentId,
    payload.data?.payment_id,
    payload.data?.paymentId,
    payload.data?.object?.metadata?.payment_id,
    payload.data?.object?.metadata?.paymentId,
  ];
  for (const candidate of candidates) {
    if (isUuidLike(candidate)) return String(candidate);
  }
  return null;
};

const resolveGenericInvoiceId = (payload: Record<string, any>) => {
  const candidates = [
    payload.invoice_id,
    payload.invoiceId,
    payload.data?.object?.metadata?.invoice_id,
    payload.data?.object?.metadata?.invoiceId,
  ];
  for (const candidate of candidates) {
    if (isUuidLike(candidate)) return String(candidate);
  }
  return null;
};

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Supabase environment is not configured" }, 500, corsHeaders);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const stripeSignature = req.headers.get("stripe-signature");
    const rawBody = await req.text();
    const parsed = safeJson(rawBody);
    if (parsed === null) {
      return json({ error: "Invalid JSON body" }, 400, corsHeaders);
    }

    const body = parsed as Record<string, any>;

    if (stripeSignature) {
      const stripeSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
      if (!stripeSecret) {
        return json({ error: "Stripe webhook secret is not configured" }, 500, corsHeaders);
      }

      const verified = await stripeWebhookSignatureValid({
        rawBody,
        signatureHeader: stripeSignature,
        secret: stripeSecret,
      });
      if (!verified) {
        return json({ error: "Invalid Stripe signature" }, 401, corsHeaders);
      }

      const eventId = stripeEventId(body);
      const eventType = stripeEventType(body);
      const paymentId = stripePaymentIdFromEvent(body);
      const providerReference = stripeProviderReferenceFromEvent(body);
      const payload = body?.data?.object ?? body;

      const { data, error } = await admin.rpc("record_payment_provider_event", {
        p_provider: "stripe",
        p_provider_event_id: eventId || `stripe-${crypto.randomUUID()}`,
        p_event_type: eventType,
        p_payload: body,
        p_payment_id: paymentId,
        p_provider_reference: providerReference,
      });

      if (error) {
        console.error("record_payment_provider_event failed", error);
        return json({ error: "Failed to ingest Stripe event" }, 500, corsHeaders);
      }

      return json({
        provider: "stripe",
        event_type: eventType,
        event_id: eventId,
        payload,
        result: data,
      }, 200, corsHeaders);
    }

    const provider = body.provider === "system"
      ? "system"
      : normalizeProvider(body.provider) ?? "xrpl";
    const eventId = String(
      body.event_id ?? body.eventId ?? body.id ?? body.tx_hash ?? body.transaction_hash ?? `event-${crypto.randomUUID()}`
    ).trim();
    const eventType = String(body.event_type ?? body.eventType ?? body.type ?? body.status ?? "").trim().toLowerCase();
    const paymentId = resolveGenericPaymentId(body);
    const invoiceId = resolveGenericInvoiceId(body);
    const providerReference =
      String(body.provider_reference ?? body.providerReference ?? body.tx_hash ?? body.transaction_hash ?? body.hash ?? "").trim() || null;

    if (!eventType) {
      return json({ error: "event_type is required" }, 400, corsHeaders);
    }

    const { data, error } = await admin.rpc("record_payment_provider_event", {
      p_provider: provider,
      p_provider_event_id: eventId,
      p_event_type: eventType,
      p_payload: body,
      p_payment_id: paymentId,
      p_invoice_id: invoiceId,
      p_provider_reference: providerReference,
    });

    if (error) {
      console.error("record_payment_provider_event failed", error);
      return json({ error: "Failed to ingest payment event" }, 500, corsHeaders);
    }

    return json({
      provider,
      event_type: eventType,
      event_id: eventId,
      result: data,
    }, 200, corsHeaders);
  } catch (err) {
    console.error("payments-webhook error", err);
    return json({ error: String(err) }, 500, corsHeaders);
  }
});
