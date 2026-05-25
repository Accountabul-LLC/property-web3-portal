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
    publishable_key?: string | null;
    checkout_url?: string | null;
    wallet_request?: Record<string, unknown> | null;
    configuration_missing?: boolean;
  };
};

export type PaymentInvoiceRecord = {
  id: string;
  invoice_number?: string | null;
  status?: string | null;
  provider_reference?: string | null;
  provider_checkout_url?: string | null;
  provider_client_secret?: string | null;
  payment_uri?: string | null;
  destination_address?: string | null;
  destination_tag?: string | null;
  memo?: string | null;
  due_at?: string | null;
  paid_at?: string | null;
  voided_at?: string | null;
  expired_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaymentProviderEventRecord = {
  id: string;
  provider?: string | null;
  provider_event_id?: string | null;
  event_type?: string | null;
  event_status?: string | null;
  status?: string | null;
  received_at?: string | null;
  processed_at?: string | null;
  payload?: Record<string, unknown> | null;
};

export type PaymentRecord = {
  id: string;
  user_id?: string | null;
  idempotency_key?: string | null;
  rail?: PaymentRail | string | null;
  provider?: string | null;
  intent?: PaymentFlow | string | null;
  status: string;
  amount?: number | string | null;
  currency?: string | null;
  title?: string | null;
  description?: string | null;
  provider_reference?: string | null;
  provider_payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  paid_at?: string | null;
  settled_at?: string | null;
  reconciled_at?: string | null;
  failed_at?: string | null;
  cancelled_at?: string | null;
  expired_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  recipient_type?: string | null;
  recipient_label?: string | null;
  recipient_reference?: string | null;
  recipient_wallet_address?: string | null;
  recipient_location_label?: string | null;
  payer_name?: string | null;
  payer_email?: string | null;
  payment_invoices?: PaymentInvoiceRecord[];
  payment_provider_events?: PaymentProviderEventRecord[];
};

export type PaymentListResponse = {
  success: boolean;
  scope: "user" | "admin";
  payments: PaymentRecord[];
  limit: number;
  offset: number;
};

export type PaymentDetailResponse = {
  success: boolean;
  payment: PaymentRecord | null;
};
