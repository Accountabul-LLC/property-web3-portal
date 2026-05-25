import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, Loader2, WalletCards } from "lucide-react";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { fetchPaymentById } from "@/components/payments/paymentsApi";
import type { PaymentProviderEventRecord, PaymentRecord } from "@/components/payments/paymentTypes";

const statusStyles: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
  reconciled: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function stageLabel(stage: PaymentProviderEventRecord) {
  return String(stage?.event_type ?? stage?.event_status ?? stage?.status ?? "unknown");
}

export default function PaymentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const invoice = payment?.payment_invoices?.[0] ?? null;
  const events = payment?.payment_provider_events ?? [];

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!id) {
      navigate("/payments/history");
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const result = await fetchPaymentById(id);
        setPayment(result.payment ?? null);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user, loading, id, navigate]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
          <Card className="p-10 text-center">
            <p className="text-lg font-medium">Payment not found</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              The payment you requested could not be loaded.
            </p>
            <Button onClick={() => navigate("/payments/history")}>Back to History</Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <button
          onClick={() => navigate("/payments/history")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Payment History
        </button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_420px]">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="space-y-2">
                <Badge className={statusStyles[payment.status] ?? "bg-muted text-muted-foreground"}>
                  {payment.status}
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight">
                  {payment.title ?? payment.recipient_label ?? "Payment detail"}
                </h1>
                <p className="text-muted-foreground">
                  Payment #{payment.id.slice(0, 8)} - {payment.intent === "invoice" ? "Invoice" : "Payment"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount</p>
                <p className="text-3xl font-bold">
                  {Number(payment.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {payment.currency}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Attachment</p>
                <p className="font-medium">{payment.recipient_type ?? "person"}</p>
                <p className="text-sm text-muted-foreground mt-1">{payment.recipient_label ?? "Unassigned"}</p>
                <p className="text-xs text-muted-foreground mt-2 break-all">
                  {payment.recipient_reference ??
                    payment.recipient_wallet_address ??
                    payment.recipient_location_label ??
                    "No reference"}
                </p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Rail</p>
                <div className="flex items-center gap-2 font-medium">
                  {payment.rail === "card" ? (
                    <CreditCard className="h-4 w-4 text-primary" />
                  ) : (
                    <WalletCards className="h-4 w-4 text-primary" />
                  )}
                  {payment.rail === "card" ? "Credit / debit card" : "Connected wallet"}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Provider: {payment.provider ?? "unknown"}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Payer</p>
                <p className="font-medium">{payment.payer_name || "Unknown"}</p>
                <p className="text-sm text-muted-foreground mt-1">{payment.payer_email || "No email"}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Timing</p>
                <p className="text-sm text-muted-foreground">Created {formatDate(payment.created_at)}</p>
                <p className="text-sm text-muted-foreground">Updated {formatDate(payment.updated_at)}</p>
                <p className="text-sm text-muted-foreground">Paid {formatDate(payment.paid_at)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium mb-2">Invoice</p>
                <p className="text-sm text-muted-foreground">Number: {invoice?.invoice_number ?? "Pending"}</p>
                <p className="text-sm text-muted-foreground">Status: {invoice?.status ?? "open"}</p>
                <p className="text-sm text-muted-foreground">
                  Provider state: {invoice?.provider_reference ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium mb-2">Provider payload</p>
                <pre className="overflow-auto text-xs leading-6 text-muted-foreground">
{JSON.stringify(payment.provider_payload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock3 className="h-5 w-5 text-primary" />
                  Status timeline
                </CardTitle>
                <CardDescription>Immutable provider and reconciliation events for this payment.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {events.length === 0 ? (
                  <div className="py-4 text-sm text-muted-foreground">No provider events yet.</div>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="rounded-xl bg-muted/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{stageLabel(event)}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.provider} - {event.provider_event_id}
                          </p>
                        </div>
                        <Badge variant="outline">{formatDate(event.received_at)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {event.event_status ?? "No status"}
                        {event.processed_at ? ` - processed ${formatDate(event.processed_at)}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Product summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  The payment is server-owned end to end. The browser collected the request; the backend created and tracks
                  the payment.
                </p>
                <p>The invoice and provider records share the same payment identifier so support can reconcile quickly.</p>
                <p>This page intentionally keeps payment language separate from donation and send/receive language.</p>
                <Link to="/payments" className="inline-flex text-foreground underline underline-offset-4">
                  Create another payment
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
