import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createCorsHeaders } from "../_shared/cors.ts";
import {
  buildXrplPaymentRequest,
  normalizeCurrency,
  normalizeIdempotencyKey,
  normalizeProvider,
  normalizeRail,
  toStripeMinorUnits,
} from "../_shared/payments.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const safeObject = (value: unknown): Record<string, any> =>
  (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {});

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Supabase environment is not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body: Record<string, any> = await req.json();
    const amount = Number(body?.amount);
    const currency = normalizeCurrency(body?.currency);
    const rail = normalizeRail(body?.rail);
    const provider = normalizeProvider(body?.provider) ?? (rail === "card" ? "stripe" : rail === "wallet" ? "xrpl" : null);
    const idempotencyKey = normalizeIdempotencyKey(body?.idempotency_key ?? body?.idempotencyKey);
    const intent = typeof body?.intent === "string"
      ? body.intent.trim().toLowerCase()
      : typeof body?.flow === "string"
        ? body.flow.trim().toLowerCase()
        : "payment";
    const attachment = safeObject(body?.attachment);
    const payer = safeObject(body?.payer);
    const title = typeof body?.title === "string" ? body.title.trim() : null;
    const description = typeof body?.description === "string" ? body.description.trim() : null;
    const dueAt = typeof body?.due_at === "string" ? body.due_at : typeof body?.dueAt === "string" ? body.dueAt : null;
    const metadata = safeObject(body?.metadata);

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Amount must be a positive number" }, 400);
    }

    if (!currency || currency.length < 3) {
      return json({ error: "Currency is required" }, 400);
    }

    if (!rail) {
      return json({ error: "Rail must be wallet or card" }, 400);
    }

    if (!provider) {
      return json({ error: "Provider must be stripe or xrpl" }, 400);
    }

    if (rail === "card" && currency === "XRP") {
      return json({ error: "Card payments require a fiat currency" }, 400);
    }

    if (rail === "wallet" && currency !== "XRP") {
      return json({ error: "Wallet payments currently require XRP" }, 400);
    }

    if (!idempotencyKey || idempotencyKey.length < 8) {
      return json({ error: "idempotency_key is required" }, 400);
    }

    const { data: kycStatus, error: kycError } = await admin.rpc("get_kyc_status", {
      p_user_id: userData.user.id,
    });
    if (kycError) {
      console.error("get_kyc_status failed", kycError);
      return json({ error: "Unable to verify KYC status" }, 500);
    }
    if (String(kycStatus ?? "").toLowerCase() !== "approved") {
      return json({ error: "KYC approval is required to create payments" }, 403);
    }

    const { data: created, error: createError } = await admin.rpc("create_payment_and_invoice", {
      p_user_id: userData.user.id,
      p_idempotency_key: idempotencyKey,
      p_amount: amount,
      p_currency: currency,
      p_rail: rail,
      p_provider: provider,
      p_title: title,
      p_description: description,
      p_due_at: dueAt,
      p_metadata: {
        ...metadata,
        intent,
        attachment,
        payer,
        source: "payments-create",
        requested_by: userData.user.id,
        requested_rail: rail,
        requested_provider: provider,
      },
    });

    if (createError) {
      console.error("create_payment_and_invoice failed", createError);
      return json({ error: createError.message ?? "Failed to create payment" }, 400);
    }

    const payment = (created as any)?.payment ?? {};
    const invoice = (created as any)?.invoice ?? {};
    const existingPaymentPayload = safeObject(payment.provider_payload);
    const existingInvoicePayload = safeObject(invoice.provider_payload);

    if (provider === "stripe") {
      if ((existingPaymentPayload.client_secret || existingInvoicePayload.client_secret) && payment.id) {
        return json({
          payment,
          invoice,
          provider: {
            provider: "stripe",
            payment_intent_id: payment.provider_reference ?? existingPaymentPayload.payment_intent_id ?? null,
            client_secret: existingInvoicePayload.client_secret ?? existingPaymentPayload.client_secret ?? null,
            status: existingPaymentPayload.stripe_status ?? "requires_payment_method",
          },
        });
      }

      const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeSecret) {
        return json({
          payment,
          invoice,
          provider: {
            provider: "stripe",
            client_secret: existingInvoicePayload.client_secret ?? null,
            payment_intent_id: payment.provider_reference ?? null,
            status: "unconfigured",
            configuration_missing: true,
          },
        });
      }

      const amountMinor = toStripeMinorUnits(amount, currency);
      const metadataForStripe = {
        payment_id: payment.id,
        invoice_id: invoice.id,
        user_id: userData.user.id,
        idempotency_key: idempotencyKey,
        rail,
        currency,
        intent,
      };

      const intentResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": idempotencyKey,
        },
        body: new URLSearchParams({
          amount: String(amountMinor),
          currency: currency.toLowerCase(),
          "payment_method_types[]": "card",
          capture_method: "automatic",
          "metadata[payment_id]": String(payment.id),
          "metadata[invoice_id]": String(invoice.id),
          "metadata[user_id]": String(userData.user.id),
          "metadata[idempotency_key]": idempotencyKey,
          "metadata[rail]": rail,
          "metadata[currency]": currency,
          "metadata[intent]": intent,
          "metadata[title]": title ?? "",
          "metadata[description]": description ?? "",
        }),
      });

      if (!intentResponse.ok) {
        const text = await intentResponse.text();
        console.error("Stripe payment_intent create failed", intentResponse.status, text);
        return json({ error: "Stripe payment intent creation failed" }, 502);
      }

      const intentBody = await intentResponse.json();
      const attachResponse = await admin.rpc("attach_payment_provider_artifacts", {
        p_payment_id: payment.id,
        p_provider: "stripe",
        p_provider_reference: intentBody.id,
        p_payment_payload: {
          stripe_status: intentBody.status,
          client_secret: intentBody.client_secret,
          amount_minor: amountMinor,
          currency,
          metadata: metadataForStripe,
        },
        p_invoice_payload: {
          stripe_status: intentBody.status,
          client_secret: intentBody.client_secret,
          amount_minor: amountMinor,
          currency,
        },
        p_provider_client_secret: intentBody.client_secret,
      });

      if (attachResponse.error) {
        console.error("attach_payment_provider_artifacts failed", attachResponse.error);
        return json({ error: "Failed to attach Stripe artifacts" }, 500);
      }

      const attached = attachResponse.data as any;
      return json({
        payment: attached?.payment ?? payment,
        invoice: attached?.invoice ?? invoice,
        provider: {
          provider: "stripe",
          payment_intent_id: intentBody.id,
          client_secret: intentBody.client_secret,
          status: intentBody.status,
        },
      });
    }

    const xrplDestinationAddress = Deno.env.get("XRPL_RECEIVING_ADDRESS");
    if (existingPaymentPayload.wallet_request || existingInvoicePayload.wallet_request) {
      const walletRequest = existingPaymentPayload.wallet_request ?? existingInvoicePayload.wallet_request;
      return json({
        payment,
        invoice,
        provider: {
          provider: "xrpl",
          status: "pending_payment",
          wallet_request: walletRequest,
        },
      });
    }

    if (!xrplDestinationAddress) {
      return json({
        payment,
        invoice,
        provider: {
          provider: "xrpl",
          status: "unconfigured",
          configuration_missing: true,
        },
      });
    }

    const walletRequest = buildXrplPaymentRequest({
      destinationAddress: xrplDestinationAddress,
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount,
      currency,
      memo: typeof body?.memo === "string" ? body.memo : null,
      title,
      description,
    });

    const attachResponse = await admin.rpc("attach_payment_provider_artifacts", {
      p_payment_id: payment.id,
      p_provider: "xrpl",
      p_payment_payload: {
        wallet_request: walletRequest,
        requested_by: userData.user.id,
      },
      p_invoice_payload: {
        wallet_request: walletRequest,
      },
      p_payment_uri: JSON.stringify(walletRequest),
      p_destination_address: walletRequest.destination_address,
      p_destination_tag: walletRequest.destination_tag,
    });

    if (attachResponse.error) {
      console.error("attach_payment_provider_artifacts failed", attachResponse.error);
      return json({ error: "Failed to attach XRPL artifacts" }, 500);
    }

    const attached = attachResponse.data as any;
    return json({
      payment: attached?.payment ?? payment,
      invoice: attached?.invoice ?? invoice,
      provider: {
        provider: "xrpl",
        status: "pending_payment",
        wallet_request: walletRequest,
      },
    });
  } catch (err) {
    console.error("payments-create error", err);
    return json({ error: String(err) }, 500);
  }
});
