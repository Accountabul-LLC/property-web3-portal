import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
    if (!key) {
      console.warn("VITE_STRIPE_PUBLISHABLE_KEY not set");
      return null;
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
