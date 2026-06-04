import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getStripe } from "@/lib/stripe";
import { callEdgeFunction } from "@/lib/edgeFunction";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tierId: string;
  tierName: string;
  interval: "monthly" | "annual";
};

export default function MembershipCheckoutModal({ open, onOpenChange, tierId, tierName, interval }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stripePromise = getStripe();

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await callEdgeFunction<{ clientSecret: string }>(
          "stripe-create-checkout",
          {
            tierId,
            interval,
            returnUrl: `${window.location.origin}/checkout/return`,
          },
          { requireAuth: false },
        );
        if (!cancelled) setClientSecret(res.clientSecret);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to start checkout");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tierId, interval]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subscribe to {tierName}</DialogTitle>
          <DialogDescription>
            Secure checkout powered by Stripe. {interval === "annual" ? "Billed annually." : "Billed monthly."}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!stripePromise && (
          <p className="text-sm text-destructive">
            Stripe publishable key not configured. Add VITE_STRIPE_PUBLISHABLE_KEY.
          </p>
        )}

        {stripePromise && clientSecret && (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}

        {stripePromise && !clientSecret && !error && (
          <p className="text-sm text-muted-foreground">Preparing checkout…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
