import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("You must be signed in to view payments.");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function invokeGet(path: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: "GET",
    headers,
  });

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload
      ? String(payload.error)
      : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export type PaymentListParams = {
  scope?: "user" | "admin";
  status?: string | null;
  limit?: number;
  offset?: number;
};

export async function fetchPayments(params: PaymentListParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.scope) searchParams.set("scope", params.scope);
  if (params.status) searchParams.set("status", params.status);
  if (typeof params.limit === "number") searchParams.set("limit", String(params.limit));
  if (typeof params.offset === "number") searchParams.set("offset", String(params.offset));

  return invokeGet(`payments-list?${searchParams.toString()}`) as Promise<{
    success: boolean;
    scope: "user" | "admin";
    payments: any[];
    limit: number;
    offset: number;
  }>;
}

export async function fetchPaymentById(id: string) {
  return invokeGet(`payments-get?id=${encodeURIComponent(id)}`) as Promise<{
    success: boolean;
    payment: any;
  }>;
}
