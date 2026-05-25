import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StripeCheckoutModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string | null;
  publishableKey: string | null;
  amountLabel: string;
  onSuccess?: () => void;
};

const stripeCache = new Map<string, Promise<Stripe | null>>();

function getStripePromise(publishableKey: string) {
  if (!stripeCache.has(publishableKey)) {
    stripeCache.set(publishableKey, loadStripe(publishableKey));
  }
  return stripeCache.get(publishableKey)!;
}

function CheckoutForm({
  amountLabel,
  onSuccess,
}: {
  amountLabel: string;
  onSuccess?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/payments/history`,
      },
    });

    if (error) {
      toast.error(error.message ?? "Card payment failed.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      toast.success("Payment successful.");
      onSuccess?.();
    } else if (paymentIntent?.status === "processing") {
      toast.info("Payment is processing.");
      onSuccess?.();
    } else {
      toast.info(`Payment status: ${paymentIntent?.status ?? "unknown"}`);
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? "Processing..." : `Pay ${amountLabel}`}
      </Button>
    </form>
  );
}

export function StripeCheckoutModal({
  open,
  onOpenChange,
  clientSecret,
  publishableKey,
  amountLabel,
  onSuccess,
}: StripeCheckoutModalProps) {
  const stripePromise = useMemo(
    () => (publishableKey ? getStripePromise(publishableKey) : null),
    [publishableKey],
  );

  const [resolvedStripe, setResolvedStripe] = useState<Stripe | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (stripePromise) {
      stripePromise.then((s) => {
        if (!cancelled) setResolvedStripe(s);
      });
    } else {
      setResolvedStripe(null);
    }
    return () => {
      cancelled = true;
    };
  }, [stripePromise]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete card payment</DialogTitle>
          <DialogDescription>
            Card details are sent directly to Stripe. Your information never touches our servers.
          </DialogDescription>
        </DialogHeader>

        {!publishableKey ? (
          <p className="text-sm text-destructive">
            Stripe publishable key is not configured. Add STRIPE_PUBLISHABLE_KEY in backend secrets.
          </p>
        ) : !clientSecret ? (
          <p className="text-sm text-muted-foreground">Preparing payment session...</p>
        ) : !resolvedStripe || !stripePromise ? (
          <p className="text-sm text-muted-foreground">Loading Stripe...</p>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <CheckoutForm amountLabel={amountLabel} onSuccess={onSuccess} />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}
