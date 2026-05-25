import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createCorsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status = 200, corsHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Supabase environment is not configured");
  if (!authHeader?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 };

  const anon = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error } = await anon.auth.getUser();
  if (error || !userData.user) return { error: "Unauthorized", status: 401 };

  return { user: userData.user, svc: createClient(supabaseUrl, serviceKey) };
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405, corsHeaders);

  try {
    const auth = await requireUser(req);
    if ("error" in auth) return json({ error: auth.error }, auth.status ?? 401, corsHeaders);

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return json({ error: "id is required" }, 400, corsHeaders);

    const isAdmin = (await auth.svc.rpc("current_user_is_admin")).data === true;

    let paymentQuery = auth.svc
      .from("payments")
      .select(`
        id, user_id, idempotency_key, rail, provider, intent, status, amount, currency, title, description,
        provider_reference, provider_payload, metadata, paid_at, settled_at, reconciled_at, failed_at,
        cancelled_at, expired_at, created_at, updated_at,
        recipient_type, recipient_label, recipient_reference, recipient_wallet_address, recipient_location_label,
        payer_name, payer_email,
        payment_invoices (
          id, invoice_number, status, provider_reference, provider_checkout_url, provider_client_secret, payment_uri,
          destination_address, destination_tag, memo, due_at, paid_at, voided_at, expired_at, created_at, updated_at
        ),
        payment_provider_events (
          id, provider, provider_event_id, event_type, event_status, received_at, processed_at, payload
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (!isAdmin) {
      paymentQuery = paymentQuery.eq("user_id", auth.user.id);
    }

    const { data, error } = await paymentQuery;
    if (error) throw error;
    if (!data) return json({ error: "Payment not found" }, 404, corsHeaders);

    return json({
      success: true,
      payment: data,
    }, 200, corsHeaders);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return json({ error: message }, 500, corsHeaders);
  }
});
