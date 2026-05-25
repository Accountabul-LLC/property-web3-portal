export type PaymentAttachmentType = "person" | "business" | "wallet" | "location";
export type PaymentFlow = "payment" | "invoice";
export type PaymentRail = "wallet" | "card";
export type PaymentCurrency = "USD" | "CAD" | "EUR" | "GBP" | "XRP";

export type PaymentDraft = {
  amount: string;
  currency: PaymentCurrency;
  attachmentType: PaymentAttachmentType;
  attachmentLabel: string;
  attachmentReference: string;
  payerName: string;
  payerEmail: string;
  memo: string;
  invoiceNumber: string;
  flow: PaymentFlow;
};

export type PaymentCheckoutRequest = {
  source: "payments-ui";
  intent: PaymentFlow;
  rail: PaymentRail;
  idempotencyKey: string;
  amount: number;
  currency: PaymentCurrency;
  attachment: {
    type: PaymentAttachmentType;
    label: string;
    reference?: string;
    walletAddress?: string;
    locationLabel?: string;
  };
  payer?: {
    name?: string;
    email?: string;
  };
  memo?: string;
  invoiceNumber?: string;
};

export type PaymentCheckoutResponse = {
  payment?: {
    id: string;
    status: string;
    rail?: string;
    provider?: string;
    provider_reference?: string | null;
    amount?: number;
    currency?: string;
    recipient_type?: string | null;
    recipient_label?: string | null;
    recipient_reference?: string | null;
    recipient_wallet_address?: string | null;
    payer_name?: string | null;
    payer_email?: string | null;
  };
  invoice?: {
    id: string;
    status: string;
    invoice_number?: string;
    provider_reference?: string | null;
    provider_checkout_url?: string | null;
    provider_client_secret?: string | null;
    payment_uri?: string | null;
  };
  provider?: {
    provider: "stripe" | "xrpl";
    status?: string;
    payment_intent_id?: string | null;
    client_secret?: string | null;
    checkout_url?: string | null;
    wallet_request?: Record<string, unknown> | null;
    configuration_missing?: boolean;
  };
};
