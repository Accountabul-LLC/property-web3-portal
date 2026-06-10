export type PaymentRail = "wallet" | "card";
export type PaymentProvider = "stripe" | "xrpl";

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set([
  "BHD",
  "IQD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND",
]);

export const normalizeCurrency = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

export const normalizeIdempotencyKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, "-");

export const normalizeRail = (value: unknown): PaymentRail | null => {
  const rail = String(value ?? "").trim().toLowerCase();
  return rail === "card" || rail === "wallet" ? rail : null;
};

export const normalizeProvider = (value: unknown): PaymentProvider | null => {
  const provider = String(value ?? "").trim().toLowerCase();
  return provider === "stripe" || provider === "xrpl" ? provider : null;
};

export const currencyExponent = (currency: string) => {
  const normalized = normalizeCurrency(currency);
  if (ZERO_DECIMAL_CURRENCIES.has(normalized)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(normalized)) return 3;
  return 2;
};

export const toStripeMinorUnits = (amount: number, currency: string) => {
  const exponent = currencyExponent(currency);
  const factor = Math.pow(10, exponent);
  return Math.round(amount * factor);
};

export const isUuidLike = (value: unknown) => {
  const str = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
};

export const xrpDestinationTagFromPaymentId = (paymentId: string) => {
  const clean = paymentId.replace(/-/g, "");
  const slice = clean.slice(0, 8).padEnd(8, "0");
  const value = Number.parseInt(slice, 16);
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.max(1, value % 2147483647);
};

export const buildXrplPaymentRequest = (params: {
  destinationAddress: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  memo?: string | null;
  title?: string | null;
  description?: string | null;
}) => {
  const destinationTag = xrpDestinationTagFromPaymentId(params.paymentId);
  return {
    destination_address: params.destinationAddress,
    destination_tag: destinationTag,
    amount: params.amount,
    currency: normalizeCurrency(params.currency),
    memo: params.memo ?? params.invoiceId,
    payment_id: params.paymentId,
    invoice_id: params.invoiceId,
    title: params.title ?? null,
    description: params.description ?? null,
  };
};

export const stripeEventId = (event: { id?: string }) => String(event.id ?? "").trim();

export const stripePaymentIdFromEvent = (event: any) => {
  const direct = event?.data?.object?.metadata?.payment_id ?? event?.data?.object?.metadata?.paymentId;
  if (isUuidLike(direct)) return String(direct);

  const invoiceDirect =
    event?.data?.object?.metadata?.invoice_id ?? event?.data?.object?.metadata?.invoiceId;
  if (isUuidLike(invoiceDirect)) return String(invoiceDirect);

  const payloadPaymentId = event?.payment_id ?? event?.paymentId;
  if (isUuidLike(payloadPaymentId)) return String(payloadPaymentId);

  return null;
};

export const stripeProviderReferenceFromEvent = (event: any) =>
  String(event?.data?.object?.payment_intent ?? event?.data?.object?.id ?? event?.id ?? "").trim() || null;

export const stripeEventType = (event: any) => String(event?.type ?? "").trim().toLowerCase();

export const timingSafeEqualStrings = (a: string, b: string) => {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    mismatch |= aBytes[i] ^ bBytes[i];
  }
  return mismatch === 0;
};

// Verifies `t=<unix seconds>,v1=<hex hmac-sha256 of "<t>.<rawBody>">` headers
// (same scheme as Stripe) and rejects timestamps outside the tolerance window
// to prevent replay.
export const genericWebhookSignatureValid = async (params: {
  rawBody: string;
  signatureHeader: string;
  secret: string;
  toleranceSeconds?: number;
}) => {
  const { rawBody, signatureHeader, secret, toleranceSeconds = 300 } = params;
  const parts = new Map<string, string>();
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) parts.set(k.trim(), v.trim());
  }
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > toleranceSeconds) return false;

  const payload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqualStrings(computed, signature);
};

export const stripeWebhookSignatureValid = async (params: {
  rawBody: string;
  signatureHeader: string;
  secret: string;
}) => {
  const { rawBody, signatureHeader, secret } = params;
  const parts = new Map<string, string>();
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) parts.set(k.trim(), v.trim());
  }
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (computed.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i += 1) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
};
