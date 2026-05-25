import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createCorsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status = 200, corsHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const stripeStatusToEventType = (status: string) => {
  switch (status) {
    case "succeeded":
      return "payment_intent.succeeded";
    case "processing":
      return "payment_intent.processing";
    case "requires_action":
      return "payment_intent.requires_action";
    case "requires_payment_method":
      return "payment_intent.payment_failed";
    case "canceled":
      return "payment_intent.canceled";
    default:
      return "payment_intent.processing";
  }
};

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);

  try {
    const reconcileSecret = Deno.env.get("PAYMENTS_RECONCILE_SECRET");
    const providedSecret = req.headers.get("x-reconcile-secret") ?? req.headers.get("X-Reconcile-Secret");
    if (!reconcileSecret || providedSecret !== reconcileSecret) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Supabase environment is not configured" }, 500, corsHeaders);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

    const summary = {
      stripe_checked: 0,
      stripe_reconciled: 0,
      expired_invoices: 0,
    };

    const { data: stripePayments, error: stripePaymentsError } = await admin
      .from("payments")
      .select("id, status, provider_reference, user_id")
      .eq("provider", "stripe")
      .in("status", ["pending_payment", "processing"]);

    if (stripePaymentsError) {
      console.error("Failed to load stripe payments", stripePaymentsError);
      return json({ error: "Failed to load payments" }, 500, corsHeaders);
    }

    for (const payment of stripePayments ?? []) {
      if (!stripeSecret || !payment.provider_reference) continue;
      summary.stripe_checked += 1;

      const resp = await fetch(`https://api.stripe.com/v1/payment_intents/${payment.provider_reference}`, {
        headers: { Authorization: `Bearer ${stripeSecret}` },
      });
      if (!resp.ok) continue;

      const intent = await resp.json();
      const eventType = stripeStatusToEventType(String(intent.status ?? ""));
      const { error } = await admin.rpc("record_payment_provider_event", {
        p_provider: "stripe",
        p_provider_event_id: `reconcile:${payment.id}:${intent.status}`,
        p_event_type: eventType,
        p_payload: {
          payment_intent: intent,
          reconciled: true,
        },
        p_payment_id: payment.id,
        p_provider_reference: payment.provider_reference,
      });
      if (!error) {
        summary.stripe_reconciled += 1;
      }
    }

    const { data: expiredInvoices, error: invoiceError } = await admin
      .from("payment_invoices")
      .select("id, payment_id, user_id, due_at, status")
      .in("status", ["open", "draft"])
      .lt("due_at", new Date().toISOString());

    if (invoiceError) {
      console.error("Failed to load invoices", invoiceError);
      return json({ error: "Failed to load invoices" }, 500, corsHeaders);
    }

    for (const invoice of expiredInvoices ?? []) {
      const eventId = `system:invoice-expired:${invoice.id}`;
      const { error } = await admin.rpc("record_payment_provider_event", {
        p_provider: "system",
        p_provider_event_id: eventId,
        p_event_type: "invoice.expired",
        p_payload: {
          invoice_id: invoice.id,
          payment_id: invoice.payment_id,
          reason: "due_at_passed",
        },
        p_payment_id: invoice.payment_id,
        p_invoice_id: invoice.id,
      });
      if (!error) {
        summary.expired_invoices += 1;
      }
    }

    return json({
      ok: true,
      summary,
    }, 200, corsHeaders);
  } catch (err) {
    console.error("payments-reconcile error", err);
    return json({ error: String(err) }, 500, corsHeaders);
  }
});
