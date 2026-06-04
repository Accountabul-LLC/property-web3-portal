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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { tierId, interval, returnUrl } = await req.json();
    if (!tierId || !["monthly", "annual"].includes(interval) || !returnUrl) {
      return json(400, { error: "tierId, interval, returnUrl required" });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json(500, { error: "Stripe not configured" });
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tier, error: tierErr } = await supabase
      .from("membership_tiers")
      .select("id, name, stripe_price_lookup_monthly, stripe_price_lookup_annual")
      .eq("id", tierId)
      .single();
    if (tierErr || !tier) return json(404, { error: "Tier not found" });

    const lookupKey = interval === "annual" ? tier.stripe_price_lookup_annual : tier.stripe_price_lookup_monthly;
    if (!lookupKey) return json(400, { error: `No Stripe price configured for ${interval}` });

    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (!prices.data.length) return json(404, { error: `Stripe price not found for lookup ${lookupKey}` });
    const price = prices.data[0];

    // Resolve auth context (optional — guests allowed)
    let userId: string | undefined;
    let email: string | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await supabase.auth.getUser(token);
      if (data?.user) {
        userId = data.user.id;
        email = data.user.email ?? undefined;
      }
    }

    // Resolve / create Stripe customer
    let customerId: string | undefined;
    if (userId) {
      const found = await stripe.customers.search({ query: `metadata['userId']:'${userId}'`, limit: 1 });
      if (found.data.length) customerId = found.data[0].id;
    }
    if (!customerId && email) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length) {
        customerId = existing.data[0].id;
        if (userId && existing.data[0].metadata?.userId !== userId) {
          await stripe.customers.update(customerId, {
            metadata: { ...existing.data[0].metadata, userId },
          });
        }
      }
    }
    if (!customerId && (email || userId)) {
      const created = await stripe.customers.create({
        ...(email && { email }),
        ...(userId && { metadata: { userId } }),
      });
      customerId = created.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      line_items: [{ price: price.id, quantity: 1 }],
      return_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerId && { customer: customerId }),
      ...(userId && {
        metadata: { userId, tierId },
        subscription_data: { metadata: { userId, tierId } },
      }),
      ...(!userId && {
        metadata: { tierId },
        subscription_data: { metadata: { tierId } },
      }),
    });

    return json(200, {
      clientSecret: session.client_secret,
      publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? null,
    });
  } catch (e) {
    console.error("stripe-create-checkout error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
