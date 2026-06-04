import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

// Public endpoint — no JWT.
const isoFromUnix = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

// deno-lint-ignore no-explicit-any
function priceLookup(item: any): string | null {
  return item?.price?.lookup_key ?? item?.price?.id ?? null;
}

// deno-lint-ignore no-explicit-any
async function persistSubscription(supabase: any, stripe: Stripe, subscription: any) {
  const item = subscription.items?.data?.[0];
  const priceId = priceLookup(item);
  const productId = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id ?? null;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const userId = subscription.metadata?.userId as string | undefined;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

  const base = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    status: subscription.status,
    current_period_start: isoFromUnix(periodStart),
    current_period_end: isoFromUnix(periodEnd),
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    environment: "sandbox",
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    await supabase.from("subscriptions").upsert({ ...base, user_id: userId }, { onConflict: "stripe_subscription_id" });
    return;
  }

  // Guest checkout — resolve email from customer
  const customer = await stripe.customers.retrieve(customerId);
  // deno-lint-ignore no-explicit-any
  const email = (customer as any)?.email as string | undefined;
  if (!email) return;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (existingProfile?.id) {
    await supabase.from("subscriptions").upsert(
      { ...base, user_id: existingProfile.id },
      { onConflict: "stripe_subscription_id" },
    );
    return;
  }

  await supabase.from("pending_memberships").upsert(
    {
      email,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: isoFromUnix(periodStart),
      current_period_end: isoFromUnix(periodEnd),
      environment: "sandbox",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

// deno-lint-ignore no-explicit-any
async function markCanceled(supabase: any, subscription: any) {
  await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);
  await supabase
    .from("pending_memberships")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const sig = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!sig || !secret || !stripeKey) return new Response("Misconfigured", { status: 500 });

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch (e) {
    console.error("Webhook signature verification failed", e);
    return new Response("Bad signature", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await persistSubscription(supabase, stripe, event.data.object);
        break;
      case "customer.subscription.deleted":
        await markCanceled(supabase, event.data.object);
        break;
      case "checkout.session.completed": {
        // deno-lint-ignore no-explicit-any
        const session = event.data.object as any;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await persistSubscription(supabase, stripe, sub);
        }
        break;
      }
      default:
        console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (e) {
    console.error("Webhook handler error", e);
    return new Response("Handler error", { status: 500 });
  }
});
