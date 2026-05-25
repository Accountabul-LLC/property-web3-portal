import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, LayoutDashboard, QrCode, ShieldCheck } from "lucide-react";

import type { PaymentCheckoutResponse, PaymentDraft, PaymentRail } from "./paymentTypes";
import { formatPaymentAmount } from "./paymentUtils";

type PaymentDeveloperConsoleProps = {
  draft: PaymentDraft;
  request: unknown;
  response: PaymentCheckoutResponse | null;
  rail: PaymentRail;
  busy: boolean;
};

function QrGlyph() {
  const pattern = [
    "1100011",
    "1011010",
    "1110111",
    "0011100",
    "1101110",
    "1001001",
    "1110001",
  ];

  return (
    <div className="grid grid-cols-7 gap-1 rounded-3xl border border-border bg-background p-3">
      {pattern.flatMap((row, rowIndex) =>
        row.split("").map((cell, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className={cell === "1" ? "h-3 w-3 rounded-[4px] bg-foreground" : "h-3 w-3 rounded-[4px] bg-muted"}
          />
        )),
      )}
    </div>
  );
}

export function PaymentDeveloperConsole({ draft, request, response, rail, busy }: PaymentDeveloperConsoleProps) {
  const payment = response?.payment ?? null;
  const invoice = response?.invoice ?? null;
  const provider = response?.provider ?? null;
  const reference = invoice?.invoice_number ?? payment?.id ?? "Waiting for the backend session to return a shareable reference.";

  return (
    <section className="space-y-5">
      <div>
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
          Developer console
        </Badge>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Internal payment diagnostics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These panels stay hidden from standard users and are available for support, QA, and future operator tooling.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <Card className="border-border/70 bg-card/90 shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Backend contract shape</CardTitle>
            <CardDescription>
              This is the exact payload the frontend prepares before handing the request to the payments edge function.
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
            <CardTitle className="text-xl">Support snapshot</CardTitle>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 bg-card/90 shadow-card">
          <CardHeader>
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              Scan / share
            </Badge>
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="h-5 w-5 text-primary" />
              QR and reference handoff
            </CardTitle>
            <CardDescription>Read-only share surface for the payment or invoice reference returned by the backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QrGlyph />
            <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {reference}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Copy className="h-4 w-4 text-primary" />
              Copy and QR output are reserved for future console workflows.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-card">
          <CardHeader>
            <Badge variant={rail === "card" ? "secondary" : "outline"} className="w-fit rounded-full px-3 py-1">
              Payment rail
            </Badge>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              Backend status
            </CardTitle>
            <CardDescription>Helpful for QA and future operator tooling.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              {provider?.provider === "stripe"
                ? "Stripe prepares the secure card checkout session server-side."
                : provider?.provider === "xrpl"
                  ? "XRPL prepares a wallet request for the connected wallet to sign."
                  : "The backend has not returned a payment session yet."}
            </p>
            <p>
              {response ? `Payment ${payment?.id ?? "record"} is ready with invoice ${invoice?.invoice_number ?? "pending"}.` : "No settlement happens here. The browser only prepares the request payload."}
            </p>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Rail: {rail === "card" ? "Card" : "Wallet"}
            </div>
            {provider?.status ? (
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Backend status: {provider.status}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-card">
          <CardHeader>
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              Next step
            </Badge>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Future console hooks
            </CardTitle>
            <CardDescription>Keep the support and debug surface available while keeping the user flow clean.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              This space can later host copy actions, QR display, support notes, and a richer developer console.
            </p>
            <p>
              The current page stays user-facing; these elements only appear in dev mode or with a debug query flag.
            </p>
            <div className="rounded-xl bg-muted/40 p-3 text-foreground">
              Draft total: {formatPaymentAmount(draft.amount, draft.currency)}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
