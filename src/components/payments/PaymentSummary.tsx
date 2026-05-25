import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock3, ShieldCheck, WalletCards } from "lucide-react";

import type { PaymentCheckoutRequest, PaymentCheckoutResponse, PaymentDraft, PaymentRail } from "./paymentTypes";
import { formatPaymentAmount, formatPaymentAttachment } from "./paymentUtils";

type PaymentSummaryProps = {
  draft: PaymentDraft;
  request: PaymentCheckoutRequest;
  response: PaymentCheckoutResponse | null;
  rail: PaymentRail;
  status: "idle" | "preparing" | "ready" | "error";
};

function JsonLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function PaymentSummary({ draft, request, response, rail, status }: PaymentSummaryProps) {
  const ready = status === "ready" && !!response;
  const payment = response?.payment ?? null;
  const invoice = response?.invoice ?? null;
  const provider = response?.provider ?? null;

  return (
    <Card className="border-border/70 bg-card/90 shadow-card">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={ready ? "secondary" : status === "error" ? "destructive" : "outline"}
            className="rounded-full px-3 py-1"
          >
            {ready ? "Payment handoff ready" : status === "error" ? "Backend contract missing" : "Draft preview"}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {rail === "card" ? "Card rail" : "Wallet rail"}
          </Badge>
        </div>
        <CardTitle className="flex items-center gap-2 text-xl">
          <WalletCards className="h-5 w-5 text-primary" />
          Live payment summary
        </CardTitle>
        <CardDescription>Everything here is read-only until the backend session is created.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Amount</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">
            {formatPaymentAmount(draft.amount, draft.currency)}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {draft.flow === "invoice" ? "Invoice request" : "One-time payment"} attached to{" "}
            {formatPaymentAttachment(draft.attachmentType, draft.attachmentLabel)}
          </div>
        </div>

        <div className="grid gap-3 text-sm">
          <JsonLine label="Attachment" value={draft.attachmentLabel || "Unassigned"} />
          <JsonLine label="Reference" value={draft.attachmentReference || "None"} />
          <JsonLine label="Payer" value={draft.payerName || "Not provided"} />
          <JsonLine label="Rail" value={rail === "card" ? "Credit / debit card" : "Connected wallet"} />
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Backend contract preview
          </div>
          <pre className="overflow-auto rounded-2xl border border-border bg-muted/30 p-4 text-xs leading-6 text-muted-foreground">
{JSON.stringify(request, null, 2)}
          </pre>
        </div>

        <Separator />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock3 className="h-4 w-4 text-primary" />
              Session status
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {ready
                ? `Payment ${payment?.id ?? "record"} is ready with invoice ${invoice?.invoice_number ?? "pending"}.`
                : "No settlement happens here. The browser only prepares the request payload."}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Provider payload
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {provider?.provider === "stripe"
                ? "Stripe creates the payment intent server-side and returns the client secret to the browser."
                : provider?.provider === "xrpl"
                  ? "XRPL returns a wallet request that the connected wallet can sign."
                  : "The backend has not returned a provider payload yet."}
            </p>
          </div>
        </div>

        {ready ? (
          <div className="space-y-3">
            <Separator />
            <div className="grid gap-3 md:grid-cols-2">
              <JsonLine label="Payment status" value={payment?.status ?? "pending"} />
              <JsonLine label="Invoice status" value={invoice?.status ?? "open"} />
              <JsonLine label="Provider" value={provider?.provider ?? "pending"} />
              <JsonLine label="Provider state" value={provider?.status ?? "pending"} />
            </div>
            <pre className="overflow-auto rounded-2xl border border-border bg-muted/30 p-4 text-xs leading-6 text-muted-foreground">
{JSON.stringify(response, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
