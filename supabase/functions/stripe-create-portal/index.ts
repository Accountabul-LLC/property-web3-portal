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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7));
    const userId = userData?.user?.id;
    if (!userId) return json(401, { error: "Unauthorized" });

    const { returnUrl } = await req.json().catch(() => ({}));

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return json(404, { error: "No subscription found" });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-12-18.acacia" });
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      ...(returnUrl && { return_url: returnUrl }),
    });
    return json(200, { url: portal.url });
  } catch (e) {
    console.error("stripe-create-portal error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
