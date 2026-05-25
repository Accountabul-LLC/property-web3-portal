import { callEdgeFunction } from "@/lib/edgeFunction";

import type {
  PaymentAttachmentType,
  PaymentCheckoutRequest,
  PaymentDraft,
  PaymentFlow,
  PaymentRail,
  PaymentCurrency,
} from "./paymentTypes";

export const PAYMENT_CREATE_FUNCTION = "payments-create";

export const PAYMENT_CURRENCIES: PaymentCurrency[] = ["USD", "CAD", "EUR", "GBP", "XRP"];

export const PAYMENT_ATTACHMENT_OPTIONS: Array<{
  value: PaymentAttachmentType;
  label: string;
  description: string;
}> = [
  { value: "person", label: "Person", description: "Attach the payment to an individual or tenant." },
  { value: "business", label: "Business", description: "Bill a company, vendor, or organization." },
  { value: "wallet", label: "Wallet", description: "Link the payment to a wallet address or wallet label." },
  { value: "location", label: "Location", description: "Tie the payment to a site, property, or branch." },
];

export const PAYMENT_FLOW_OPTIONS: Array<{
  value: PaymentFlow;
  label: string;
  description: string;
}> = [
  { value: "payment", label: "Payment", description: "One-time settlement request." },
  { value: "invoice", label: "Invoice", description: "Structured payment request with a reference." },
];

export const PAYMENT_RAIL_OPTIONS: Array<{
  value: PaymentRail;
  label: string;
  description: string;
}> = [
  { value: "wallet", label: "Connected wallet", description: "Prepare a wallet handoff for the payer." },
  { value: "card", label: "Credit / debit card", description: "Prepare a Stripe-ready card payment." },
];

export function attachmentReferenceLabel(type: PaymentAttachmentType) {
  switch (type) {
    case "person":
      return "Person reference";
    case "business":
      return "Business reference";
    case "wallet":
      return "Wallet address or label";
    case "location":
    default:
      return "Location reference";
  }
}

export function formatPaymentAmount(amountValue: string, currency: PaymentCurrency) {
  const parsed = Number(amountValue);
  const amount = Number.isFinite(parsed) ? parsed : 0;

  if (currency === "XRP") {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} XRP`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPaymentAttachment(type: PaymentAttachmentType, label: string) {
  return `${type.charAt(0).toUpperCase() + type.slice(1)} - ${label || "Unassigned"}`;
}

export function buildPaymentCheckoutRequest(
  draft: PaymentDraft,
  rail: PaymentRail,
  idempotencyKey: string,
): PaymentCheckoutRequest {
  const amount = Number(draft.amount);
  const attachmentLabel = draft.attachmentLabel.trim() || "Unassigned";
  const attachmentReference = draft.attachmentReference.trim();

  return {
    source: "payments-ui",
    intent: draft.flow,
    rail,
    idempotencyKey,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: draft.currency,
    attachment: {
      type: draft.attachmentType,
      label: attachmentLabel,
      reference: attachmentReference || undefined,
      walletAddress: draft.attachmentType === "wallet" ? attachmentReference || undefined : undefined,
      locationLabel: draft.attachmentType === "location" ? attachmentLabel : undefined,
    },
    payer: {
      name: draft.payerName.trim() || undefined,
      email: draft.payerEmail.trim() || undefined,
    },
    memo: draft.memo.trim() || undefined,
    invoiceNumber: draft.invoiceNumber.trim() || undefined,
  };
}

export async function createPaymentCheckoutSession(request: PaymentCheckoutRequest) {
  return callEdgeFunction(PAYMENT_CREATE_FUNCTION, request, { requireAuth: true });
}
