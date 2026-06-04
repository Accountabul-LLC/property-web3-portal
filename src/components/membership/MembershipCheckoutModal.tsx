import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { callEdgeFunction } from "@/lib/edgeFunction";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tierId: string;
  tierName: string;
  interval: "monthly" | "annual";
};

const stripeCache = new Map<string, Promise<Stripe | null>>();
const getStripeFor = (key: string) => {
  if (!stripeCache.has(key)) stripeCache.set(key, loadStripe(key));
  return stripeCache.get(key)!;
};

export default function MembershipCheckoutModal({ open, onOpenChange, tierId, tierName, interval }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setPublishableKey(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await callEdgeFunction<{ clientSecret: string; publishableKey: string | null }>(
          "stripe-create-checkout",
          { tierId, interval, returnUrl: `${window.location.origin}/checkout/return` },
          { requireAuth: false },
        );
        if (!cancelled) {
          setClientSecret(res.clientSecret);
          setPublishableKey(res.publishableKey);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to start checkout");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tierId, interval]);

  const stripePromise = useMemo(() => (publishableKey ? getStripeFor(publishableKey) : null), [publishableKey]);

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

        {!error && (!clientSecret || !stripePromise) && (
          <p className="text-sm text-muted-foreground">Preparing checkout…</p>
        )}

        {stripePromise && clientSecret && (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
