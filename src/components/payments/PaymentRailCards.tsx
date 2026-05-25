import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, WalletCards } from "lucide-react";

import type { PaymentRail } from "./paymentTypes";

type PaymentRailCardsProps = {
  busy: boolean;
  activeRail: PaymentRail;
  onCheckout: (rail: PaymentRail) => void;
};

export function PaymentRailCards({
  busy,
  activeRail,
  onCheckout,
}: PaymentRailCardsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
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
            Use this when the payer will complete the payment from a connected wallet.
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
            Use this when the payer will complete the payment with a card checkout session.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
