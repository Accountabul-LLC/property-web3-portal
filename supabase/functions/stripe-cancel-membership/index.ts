import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function computeProration(stripe: Stripe, subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice.payments", "items.data.price"],
  });
  const item = sub.items?.data?.[0];
  // deno-lint-ignore no-explicit-any
  const periodStart = (item as any)?.current_period_start ?? (sub as any).current_period_start;
  // deno-lint-ignore no-explicit-any
  const periodEnd = (item as any)?.current_period_end ?? (sub as any).current_period_end;
  // deno-lint-ignore no-explicit-any
  const latestInvoice = typeof sub.latest_invoice === "string" ? null : (sub.latest_invoice as any);
  const originalAmount: number = latestInvoice?.amount_paid ?? item?.price?.unit_amount ?? 0;
  const currency: string = latestInvoice?.currency ?? item?.price?.currency ?? "usd";

  const nowSec = Math.floor(Date.now() / 1000);
  const cycleSeconds = (periodEnd ?? nowSec) - (periodStart ?? nowSec);
  const cycleDays = Math.max(1, Math.round(cycleSeconds / 86400));
  const elapsedDays = Math.max(0, Math.min(cycleDays, Math.round((nowSec - (periodStart ?? nowSec)) / 86400)));
  const remainingDays = Math.max(0, cycleDays - elapsedDays);
  const refundAmount = Math.max(0, Math.floor((originalAmount * remainingDays) / cycleDays));

  return { sub, latestInvoice, originalAmount, currency, cycleDays, elapsedDays, remainingDays, refundAmount, periodStart, periodEnd };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7));
    const userId = userData?.user?.id;
    if (!userId) return json(401, { error: "Unauthorized" });

    const { mode } = await req.json().catch(() => ({ mode: "preview" }));
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-12-18.acacia" });

    const { data: row } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row?.stripe_subscription_id) return json(404, { error: "No active subscription" });

    const p = await computeProration(stripe, row.stripe_subscription_id);

    if (mode === "preview") {
      return json(200, {
        originalAmountCents: p.originalAmount,
        refundAmountCents: p.refundAmount,
        currency: p.currency,
        daysUsed: p.elapsedDays,
        daysRemaining: p.remainingDays,
        cycleStart: p.periodStart ? new Date(p.periodStart * 1000).toISOString() : null,
        cycleEnd: p.periodEnd ? new Date(p.periodEnd * 1000).toISOString() : null,
      });
    }

    // mode === "confirm" → issue refund + cancel
    let refundId: string | null = null;
    if (p.refundAmount > 0 && p.latestInvoice) {
      const paymentIntentId: string | undefined =
        typeof p.latestInvoice.payment_intent === "string" ? p.latestInvoice.payment_intent : p.latestInvoice.payment_intent?.id;
      const chargeId: string | undefined =
        typeof p.latestInvoice.charge === "string" ? p.latestInvoice.charge : p.latestInvoice.charge?.id;
      if (paymentIntentId || chargeId) {
        const refund = await stripe.refunds.create({
          amount: p.refundAmount,
          ...(paymentIntentId ? { payment_intent: paymentIntentId } : { charge: chargeId! }),
        });
        refundId = refund.id;
      }
    }

    await stripe.subscriptions.cancel(row.stripe_subscription_id);

    await supabase.from("cancellation_audit").insert({
      user_id: userId,
      stripe_subscription_id: row.stripe_subscription_id,
      stripe_customer_id: row.stripe_customer_id,
      stripe_refund_id: refundId,
      original_amount_cents: p.originalAmount,
      refund_amount_cents: p.refundAmount,
      currency: p.currency,
      cycle_start: p.periodStart ? new Date(p.periodStart * 1000).toISOString() : null,
      cycle_end: p.periodEnd ? new Date(p.periodEnd * 1000).toISOString() : null,
      days_used: p.elapsedDays,
      days_remaining: p.remainingDays,
    });

    await supabase
      .from("subscriptions")
      .update({ status: "canceled", current_period_end: new Date().toISOString() })
      .eq("stripe_subscription_id", row.stripe_subscription_id);

    return json(200, { ok: true, refundCents: p.refundAmount });
  } catch (e) {
    console.error("stripe-cancel-membership error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
