import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { BellRing, Copy, QrCode, WalletCards, CreditCard } from "lucide-react";

import type { PaymentCheckoutResponse, PaymentRail } from "./paymentTypes";

type PaymentRailCardsProps = {
  response: PaymentCheckoutResponse | null;
  busy: boolean;
  activeRail: PaymentRail;
  onCheckout: (rail: PaymentRail) => void;
};

const QR_PATTERN = [
  "1100011",
  "1011010",
  "1110111",
  "0011100",
  "1101110",
  "1001001",
  "1110001",
];

function QrGlyph() {
  return (
    <div className="grid grid-cols-7 gap-1 rounded-3xl border border-border bg-background p-3">
      {QR_PATTERN.flatMap((row, rowIndex) =>
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

export function PaymentRailCards({
  response,
  busy,
  activeRail,
  onCheckout,
}: PaymentRailCardsProps) {
  const [copied, setCopied] = useState(false);

  const copyPaymentReference = async () => {
    const reference = response?.invoice?.invoice_number ?? response?.payment?.id ?? null;
    if (!reference) return;
    await navigator.clipboard.writeText(reference);
    setCopied(true);
    toast.success("Payment reference copied.");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const payment = response?.payment ?? null;
  const invoice = response?.invoice ?? null;
  const provider = response?.provider ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-border/70 bg-card/90 shadow-card">
        <CardHeader>
          <Badge variant={activeRail === "wallet" ? "secondary" : "outline"} className="w-fit rounded-full px-3 py-1">
            Connected wallet
          </Badge>
          <CardTitle className="flex items-center gap-2 text-lg">
            <WalletCards className="h-5 w-5 text-primary" />
            Wallet handoff
          </CardTitle>
          <CardDescription>
            Prepare a wallet request that can be signed by the connected wallet. Settlement stays outside the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" variant="secondary" onClick={() => onCheckout("wallet")} disabled={busy} className="w-full">
            {busy && activeRail === "wallet" ? "Preparing..." : "Prepare wallet payment"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Keep the browser thin. The backend should return the wallet session and any deep link the wallet provider
            needs.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-card">
        <CardHeader>
          <Badge variant={activeRail === "card" ? "secondary" : "outline"} className="w-fit rounded-full px-3 py-1">
            Credit / debit card
          </Badge>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            Stripe-ready card payment
          </CardTitle>
          <CardDescription>
            Lovable can mount the client-side Stripe handoff here once the backend contract returns a client secret.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" onClick={() => onCheckout("card")} disabled={busy} className="w-full">
            {busy && activeRail === "card" ? "Preparing..." : "Prepare card payment"}
          </Button>
          <p className="text-xs text-muted-foreground">
            No card settlement logic lives in the browser. This only requests the session payload from the backend.
          </p>
        </CardContent>
      </Card>

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
            {invoice?.invoice_number ?? payment?.id ?? "Waiting for the backend session to return a shareable reference."}
          </div>
          <Button type="button" variant="outline" onClick={copyPaymentReference} disabled={!payment && !invoice} className="w-full">
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "Copied" : "Copy reference"}
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BellRing className="h-4 w-4 text-primary" />
            Notifications stay informational only. No privileged browser actions are hidden here.
          </div>
          {provider?.status ? (
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Backend status: {provider.status}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
