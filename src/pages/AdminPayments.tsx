import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CreditCard, Landmark, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { fetchPayments } from "@/components/payments/paymentsApi";

type PaymentRow = {
  id: string;
  status: string;
  intent?: string;
  rail?: string;
  provider?: string;
  amount?: number;
  currency?: string;
  recipient_type?: string | null;
  recipient_label?: string | null;
  recipient_reference?: string | null;
  recipient_wallet_address?: string | null;
  payer_name?: string | null;
  payer_email?: string | null;
  provider_reference?: string | null;
  created_at?: string;
  payment_invoices?: Array<{
    id: string;
    payment_id: string;
    invoice_number?: string;
    status?: string;
    provider_reference?: string | null;
  }>;
};

const AdminPayments = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useTeamAccess();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || accessLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!hasAccess) {
      navigate("/dashboard");
    }
  }, [user, authLoading, hasAccess, accessLoading, navigate]);

  useEffect(() => {
    if (!user || !hasAccess) return;

    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchPayments({ scope: "admin", status, limit: 50 });
        setPayments((result.payments as PaymentRow[]) ?? []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, hasAccess, status]);

  const invoiceCount = useMemo(
    () => payments.filter((payment) => (payment.payment_invoices?.length ?? 0) > 0).length,
    [payments],
  );

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!hasAccess) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Payments Admin</h1>
            <p className="text-sm text-muted-foreground">Observe payment onboarding, invoices, and settlement state.</p>
          </div>
          <Link
            to="/admin/payments/console"
            className="ml-auto inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Open developer console
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Payments</div>
              <div className="mt-2 text-2xl font-semibold">{payments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Invoices</div>
              <div className="mt-2 text-2xl font-semibold">{invoiceCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stripe</div>
              <div className="mt-2 text-2xl font-semibold">{payments.filter((p) => p.provider === "stripe").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">XRPL</div>
              <div className="mt-2 text-2xl font-semibold">{payments.filter((p) => p.provider === "xrpl").length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              Payment ledger
            </CardTitle>
            <CardDescription>Server-owned payment records with attached invoice and recipient context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All", value: null },
                { label: "Pending", value: "pending_payment" },
                { label: "Processing", value: "processing" },
                { label: "Paid", value: "paid" },
                { label: "Failed", value: "failed" },
                { label: "Reconciled", value: "reconciled" },
              ].map((filter) => (
                <Badge
                  key={filter.label}
                  variant={status === filter.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setStatus(filter.value)}
                >
                  {filter.label}
                </Badge>
              ))}
            </div>
            {loading ? (
              <div className="py-8 text-sm text-muted-foreground">Loading payments...</div>
            ) : payments.length === 0 ? (
              <div className="py-8 text-sm text-muted-foreground">No payments have been created yet.</div>
            ) : (
              payments.map((payment) => {
                const invoice = payment.payment_invoices?.[0];
                return (
                  <div key={payment.id} className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{payment.status}</Badge>
                          <Badge variant="outline">{payment.provider ?? "unknown"}</Badge>
                          <Badge variant="outline">{payment.rail ?? "rail"}</Badge>
                        </div>
                        <div className="font-medium">
                          {payment.amount} {payment.currency ?? ""}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.intent ?? "payment"} for {payment.recipient_type ?? "person"}{" "}
                          {payment.recipient_label ? `- ${payment.recipient_label}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {payment.payer_name || "Unknown payer"}
                          {payment.payer_email ? ` - ${payment.payer_email}` : ""}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{new Date(payment.created_at ?? "").toLocaleString()}</div>
                        <div className="mt-1 font-mono">
                          {invoice?.invoice_number ?? payment.provider_reference ?? payment.id}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <WalletCards className="h-4 w-4 text-primary" />
                Wallet-linked payments
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Payments tied to connected wallets stay visible here for reconciliation and support.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-primary" />
                Card rail
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Stripe payment intents and client secrets are created server-side only.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Landmark className="h-4 w-4 text-primary" />
                Audit trail
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Webhooks and reconciliation updates are written to the provider event log.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminPayments;
