import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LogIn, Lock, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildPaymentCheckoutRequest,
  createPaymentCheckoutSession,
  formatPaymentAmount,
  PAYMENT_CURRENCIES,
} from "@/components/payments/paymentUtils";
import { PaymentComposer } from "@/components/payments/PaymentComposer";
import { PaymentRailCards } from "@/components/payments/PaymentRailCards";
import { PaymentSummary } from "@/components/payments/PaymentSummary";
import { StripeCheckoutModal } from "@/components/payments/StripeCheckoutModal";
import type { PaymentCheckoutResponse, PaymentDraft, PaymentRail } from "@/components/payments/paymentTypes";
import { useAuth } from "@/hooks/useAuth";
import { useKycStatus } from "@/hooks/useKycStatus";

const DEFAULT_PAYMENT_DRAFT: PaymentDraft = {
  amount: "250.00",
  currency: "USD",
  attachmentType: "person",
  attachmentLabel: "Tenant A",
  attachmentReference: "tenant-a@example.com",
  payerName: "",
  payerEmail: "",
  memo: "Service fee or monthly charge",
  invoiceNumber: "INV-0001",
  flow: "payment",
};

export default function Payments() {
  const { user, loading: authLoading } = useAuth();
  const { status: kycStatus, isApproved: kycApproved, isLoading: kycLoading } = useKycStatus();
  const [draft, setDraft] = useState<PaymentDraft>(DEFAULT_PAYMENT_DRAFT);
  const [rail, setRail] = useState<PaymentRail>(() =>
    typeof window !== "undefined" && localStorage.getItem("accountabul_preferred_payment_rail") === "wallet"
      ? "wallet"
      : "card",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "preparing" | "ready" | "error">("idle");
  const [response, setResponse] = useState<PaymentCheckoutResponse | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [stripeModalOpen, setStripeModalOpen] = useState(false);
  const updateDraft = (field: keyof PaymentDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value } as PaymentDraft));
  };

  const request = useMemo(
    () => buildPaymentCheckoutRequest(draft, rail, idempotencyKey),
    [draft, rail, idempotencyKey],
  );

  useEffect(() => {
    localStorage.setItem("accountabul_preferred_payment_rail", rail);
  }, [rail]);

  const handleCheckout = async (nextRail: PaymentRail) => {
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount before preparing the payment.");
      return;
    }

    const nextDraft: PaymentDraft =
      nextRail === "wallet" && draft.currency !== "XRP"
        ? { ...draft, currency: "XRP" }
        : draft;

    if (nextRail === "card" && nextDraft.currency === "XRP") {
      toast.error("Card payments need a fiat currency. Choose USD, CAD, EUR, or GBP.");
      return;
    }

    if (!nextDraft.attachmentLabel.trim()) {
      toast.error("Add a person, business, wallet, or location label first.");
      return;
    }

    if (!user) {
      toast.error("Sign in first so we can prepare your payment session.");
      return;
    }

    if (!kycApproved) {
      toast.error("Complete KYC before preparing a live payment.");
      return;
    }

    setBusy(true);
    setRail(nextRail);
    setStatus("preparing");

    const requestBody = buildPaymentCheckoutRequest(nextDraft, nextRail, idempotencyKey);

    try {
      const backendResponse = (await createPaymentCheckoutSession(requestBody)) as PaymentCheckoutResponse;
      setDraft(nextDraft);
      setResponse(backendResponse);
      setStatus("ready");
      setIdempotencyKey(crypto.randomUUID());
      toast.success("Payment request prepared.");
      if (
        nextRail === "card" &&
        backendResponse.provider?.provider === "stripe" &&
        backendResponse.provider?.client_secret &&
        backendResponse.provider?.publishable_key
      ) {
        setStripeModalOpen(true);
      } else if (
        nextRail === "card" &&
        backendResponse.provider?.configuration_missing
      ) {
        toast.error("Stripe is not configured. Add STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY.");
      }
    } catch (error) {
      setResponse(null);
      setStatus("error");
      toast.error(error instanceof Error ? error.message : "Could not prepare the payment request.");
    } finally {
      setBusy(false);
    }
  };

  const payment = response?.payment ?? null;
  const invoice = response?.invoice ?? null;
  const provider = response?.provider ?? null;
  const needsIdentity = !user || !kycApproved;
  const identityTitle = !user
    ? "Sign in to continue"
    : kycApproved
      ? ""
      : "Complete KYC to continue";
  const identityDescription = !user
    ? "You can view the payment product now, but you need to sign in before creating a live payment session."
    : kycStatus === "rejected" || kycStatus === "expired"
      ? "Your verification needs attention before you can create payments."
      : "Payments are visible, but the live checkout stays locked until KYC is approved.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.16),_transparent_24%),linear-gradient(180deg,_rgba(3,7,18,0.04),_rgba(3,7,18,0.01))]" />

      <Navigation />

      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-8 lg:px-8 2xl:max-w-[1800px]">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px] xl:items-end">
          <div className="space-y-5">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
              <WalletCards className="mr-2 h-3.5 w-3.5" />
              Payments and invoices
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
                Create a payment, attach it to the right entity, and send it through wallet or card rails.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Build a structured payment or invoice request with amount, currency, and a person, business, wallet, or
                location attachment. The browser only prepares the request. Settlement stays server-side.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                <ReceiptText className="mr-2 h-3.5 w-3.5" />
                Invoice and payment flows
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                No browser settlement logic
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                <WalletCards className="mr-2 h-3.5 w-3.5" />
                Wallet and card rails
              </Badge>
              <Link
                to="/payments/history"
                className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                View payment history
              </Link>
              <Link
                to="/settings"
                className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                Payment settings
              </Link>
            </div>
            {authLoading || kycLoading ? (
              <div className="rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                Checking your access...
              </div>
            ) : needsIdentity ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                <div className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4" />
                  {identityTitle}
                </div>
                <p className="mt-1 text-sm opacity-90">{identityDescription}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {!user ? (
                    <Link
                      to="/auth"
                      className="inline-flex items-center rounded-full bg-amber-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-900 dark:bg-amber-50 dark:text-amber-950 dark:hover:bg-white"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in
                    </Link>
                  ) : null}
                  <Link
                    to="/kyc"
                    className="inline-flex items-center rounded-full border border-amber-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/30"
                  >
                    Verify identity
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <Card className="border-border/70 bg-card/90 shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Current draft</CardTitle>
              <CardDescription>Read-only preview of the payment request you are building.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Amount</div>
                <div className="mt-2 text-3xl font-semibold">{formatPaymentAmount(draft.amount, draft.currency)}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {draft.flow === "invoice" ? "Invoice request" : "One-time payment"} attached to {draft.attachmentLabel}
                </div>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Entity</div>
                  <div className="mt-1 font-medium">{draft.attachmentType}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Rail</div>
                  <div className="mt-1 font-medium">{rail === "card" ? "Credit / debit card" : "Connected wallet"}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Currencies</div>
                  <div className="mt-1 font-medium">{PAYMENT_CURRENCIES.join(", ")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="compose" className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_420px]">
          <PaymentComposer draft={draft} busy={busy} onChange={updateDraft} onCheckout={handleCheckout} />

          <div className="space-y-6">
            <PaymentSummary draft={draft} response={response} rail={rail} status={status} />
            <Card className="border-border/70 bg-card/90 shadow-card">
              <CardHeader>
                <CardTitle className="text-xl">After you continue</CardTitle>
                <CardDescription>The finished payment will show up in your history for review and support.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Card payments open a secure Stripe checkout. Wallet payments prepare a wallet request for signing.
                </p>
                <p>
                  You can come back later to see the payment status, invoice number, and any reconciliation updates.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="rails" className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Payment rails</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Wallet and card sit side-by-side so the user can choose a payment rail without drifting into donation or
              generic transfer wording.
            </p>
          </div>
          <PaymentRailCards
            busy={busy}
            activeRail={rail}
            onCheckout={handleCheckout}
          />
        </section>

      </main>

      <Footer />

      <StripeCheckoutModal
        open={stripeModalOpen}
        onOpenChange={setStripeModalOpen}
        clientSecret={response?.provider?.client_secret ?? null}
        publishableKey={response?.provider?.publishable_key ?? null}
        amountLabel={formatPaymentAmount(draft.amount, draft.currency)}
        onSuccess={() => setStripeModalOpen(false)}
      />
    </div>
  );
}
