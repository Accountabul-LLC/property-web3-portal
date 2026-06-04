import Stripe from "npm:stripe@17";

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
    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") return json(400, { error: "sessionId required" });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json(500, { error: "Stripe not configured" });
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    const sub = typeof session.subscription === "string" ? null : session.subscription;
    const item = sub?.items?.data?.[0];

    return json(200, {
      email: session.customer_details?.email ?? session.customer_email ?? null,
      subscriptionId: typeof session.subscription === "string" ? session.subscription : sub?.id ?? null,
      customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      priceId: item?.price?.lookup_key ?? item?.price?.id ?? null,
      status: sub?.status ?? session.status ?? null,
    });
  } catch (e) {
    console.error("stripe-get-checkout-session error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
