import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Loader2, ReceiptText, WalletCards } from "lucide-react";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { fetchPayments } from "@/components/payments/paymentsApi";
import type { PaymentRecord } from "@/components/payments/paymentTypes";

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

export default function PaymentsHistory() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const statusLabel = useMemo(() => status ?? "all", [status]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const result = await fetchPayments({ scope: "user", status, limit: 100 });
        setPayments(result.payments ?? []);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user, loading, status, navigate]);

  const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <button
          onClick={() => navigate("/payments")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Payments
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <ReceiptText className="w-3.5 h-3.5" />
              Payment history
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">My Payments</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Track every payment, invoice, provider status, and settlement step from one place.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            <Card className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Total Payments</p>
              <p className="text-lg font-bold mt-1">{payments.length}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className="text-lg font-bold mt-1">
                {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Filter</p>
              <p className="text-lg font-bold mt-1">{statusLabel}</p>
            </Card>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { label: "All", value: null },
            { label: "Pending", value: "pending_payment" },
            { label: "Processing", value: "processing" },
            { label: "Paid", value: "paid" },
            { label: "Failed", value: "failed" },
            { label: "Reconciled", value: "reconciled" },
          ].map((filter) => (
            <Button
              key={filter.label}
              variant={status === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && payments.length === 0 && (
          <Card className="p-10 text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">No payments yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Once you create a payment or invoice, it will show up here with its provider status.
            </p>
            <Button onClick={() => navigate("/payments")}>Create a Payment</Button>
          </Card>
        )}

        {!isLoading && payments.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {payments.map((payment) => {
              const invoice = payment.payment_invoices?.[0];
              const providerState =
                payment.provider_payload?.stripe_status ??
                payment.provider_payload?.wallet_request?.status ??
                payment.provider_payload?.status ??
                "pending";

              return (
                <Card key={payment.id} className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        {payment.intent === "invoice" ? "Invoice" : "Payment"}
                      </p>
                      <h3 className="text-lg font-semibold text-foreground line-clamp-2">
                        {payment.title ?? payment.recipient_label ?? "Untitled payment"}
                      </h3>
                    </div>
                    <Badge className={statusStyles[payment.status] ?? "bg-muted text-muted-foreground"}>
                      {payment.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="text-2xl font-bold text-foreground">
                        {Number(payment.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {payment.currency}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(payment.created_at)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Attachment</p>
                      <p className="font-medium">
                        {payment.recipient_type ?? "person"} - {payment.recipient_label ?? "Unassigned"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 break-all">
                        {payment.recipient_reference ??
                          payment.recipient_wallet_address ??
                          payment.recipient_location_label ??
                          "No reference"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Invoice</p>
                      <p className="font-medium">{invoice?.invoice_number ?? "Pending invoice"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {invoice?.status ?? "open"} - {providerState}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {payment.rail === "card" ? (
                        <CreditCard className="h-3.5 w-3.5" />
                      ) : (
                        <WalletCards className="h-3.5 w-3.5" />
                      )}
                      {payment.provider === "stripe" ? "Stripe" : "XRPL"}
                    </div>
                    <Link
                      to={`/payments/${payment.id}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      Open Details
                      <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
