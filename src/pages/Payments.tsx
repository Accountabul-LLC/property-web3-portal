import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
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
  const [draft, setDraft] = useState<PaymentDraft>(DEFAULT_PAYMENT_DRAFT);
  const [rail, setRail] = useState<PaymentRail>("card");
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.16),_transparent_24%),linear-gradient(180deg,_rgba(3,7,18,0.04),_rgba(3,7,18,0.01))]" />

      <Navigation />

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:px-8">
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
                <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
                Backend handoff ready
              </Badge>
              <Link
                to="/payments/history"
                className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                View payment history
              </Link>
            </div>
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
            <PaymentSummary draft={draft} request={request} response={response} rail={rail} status={status} />
            <Card className="border-border/70 bg-card/90 shadow-card">
              <CardHeader>
                <CardTitle className="text-xl">Read-only support snapshot</CardTitle>
                <CardDescription>Observational data only. No privileged browser actions are exposed here.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Browser status</div>
                  <div className="mt-1 font-medium">{busy ? "Preparing handoff" : "Idle"}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Session state</div>
                  <div className="mt-1 font-medium">{response ? "Ready" : "Draft only"}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reference</div>
                  <div className="mt-1 font-medium">{draft.invoiceNumber || "None"}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Contract mode</div>
                  <div className="mt-1 font-medium">Thin client only</div>
                </div>
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
            response={response}
            busy={busy}
            activeRail={rail}
            onCheckout={handleCheckout}
          />
        </section>

        <section id="contract" className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <Card className="border-border/70 bg-card/90 shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Backend contract shape</CardTitle>
              <CardDescription>
                This is the exact payload the frontend prepares before handing the request to the payments edge
                function.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-2xl border border-border bg-muted/30 p-4 text-xs leading-6 text-muted-foreground">
{JSON.stringify(request, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90 shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Next dependency</CardTitle>
              <CardDescription>The frontend is ready. The backend endpoint owns settlement and reconciliation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                `payments-create` should return the payment and invoice records plus a provider payload. For Stripe, that
                means the `client_secret`. For XRPL, that means the wallet request details.
              </p>
              <p>
                Until then, this page remains a thin request builder and read-only preview. No settlement is performed in
                the browser.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
