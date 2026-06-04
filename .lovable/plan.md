## Goal
Port the membership / subscription Stripe setup from **Real Estate Explorer** into this project so `/pricing` becomes a working subscription checkout. The other project uses TanStack Start server functions — here we'll re-implement the same behavior with **Supabase Edge Functions** (this is a React + Vite + Supabase stack). All Stripe secrets are already configured (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`).

## What gets ported (feature parity)
1. Stripe Embedded Checkout for 3 tiers (Starter / Professional / Portfolio), monthly + annual toggle.
2. Guest checkout supported (no auth required to pay). If signed in we tag the Stripe Customer/Subscription with `userId`.
3. Post-purchase `/checkout/return` page that retrieves the session and, for guests, prompts account creation; matching `pending_memberships` row is linked to the new user on signup.
4. `/account/billing` page: shows current tier, renewal date, Stripe Billing Portal button, custom Cancel-with-prorated-refund flow.
5. Webhook handler keeps `subscriptions` in sync.
6. Membership gating reads from `subscriptions.status` (active/trialing) instead of `profiles.membership_tier_id`.

## Database (one migration)
- New table `subscriptions` — user_id, stripe_subscription_id (unique), stripe_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment.
- New table `pending_memberships` — email, stripe_subscription_id (unique), stripe_customer_id, product_id, price_id, status, current_period_*, environment.
- New table `cancellation_audit` — user_id, stripe_subscription_id, stripe_customer_id, stripe_refund_id, original_amount_cents, refund_amount_cents, currency, cycle_start, cycle_end, days_used, days_remaining.
- Add columns to `membership_tiers`: `stripe_price_lookup_monthly`, `stripe_price_lookup_annual` (text). Admin sets these in `/admin/pricing`.
- Extend `handle_new_user` trigger to move any `pending_memberships` row matching the new user's email into `subscriptions`.
- RLS: users can `SELECT` own `subscriptions` / `cancellation_audit`. `pending_memberships` is service-role only. GRANTs for `authenticated` + `service_role` on each new table.

## Edge functions (new, under `supabase/functions/`)
- `stripe-create-checkout` — POST `{ tierId, interval: 'monthly'|'annual', returnUrl }` → returns `{ clientSecret }`. Resolves/creates customer (by `metadata.userId` for signed-in users, by email for guests), creates embedded checkout session in subscription mode with `managed_payments: { enabled: true }`.
- `stripe-get-checkout-session` — POST `{ sessionId }` → returns `{ email, subscriptionId, customerId, priceId, status }` for the return page.
- `stripe-create-portal` — POST `{ returnUrl }` (auth required) → returns `{ url }`.
- `stripe-preview-cancel` / `stripe-cancel-membership` — auth required, computes prorated refund (`remaining_days / cycle_days × amount_paid`), issues refund, cancels subscription immediately, writes `cancellation_audit`, flips local `subscriptions.status` to canceled.
- `stripe-webhook` — verifies signature via `STRIPE_WEBHOOK_SECRET`, handles `customer.subscription.{created,updated,deleted}` and `checkout.session.completed`; writes to `subscriptions` when `metadata.userId` is present, otherwise upserts `pending_memberships` keyed by Stripe customer email. Deployed with `verify_jwt = false`.

All functions use `npm:stripe@^17` and the shared CORS helper already used in this project.

## Frontend changes
- `src/lib/stripe.ts` — `getStripe()` using `STRIPE_PUBLISHABLE_KEY` from env.
- `src/components/membership/StripeEmbeddedCheckout.tsx` — wraps `@stripe/react-stripe-js` `EmbeddedCheckoutProvider` in a dialog.
- `src/hooks/useStripeCheckout.ts` — calls `stripe-create-checkout`.
- `src/hooks/useSubscription.ts` — reads `subscriptions` for current user (replaces `useMyMembership` for gating).
- `src/pages/Pricing.tsx` — replace `useSelectMembership` (which just updates `profiles.membership_tier_id`) with `useStripeCheckout`; CTA opens the embedded checkout dialog. Monthly/annual toggle drives which lookup key is used.
- `src/pages/CheckoutReturn.tsx` (`/checkout/return`) — reads `session_id`, calls `stripe-get-checkout-session`, shows success state; for guests shows "finish creating your account" form.
- `src/pages/AccountBilling.tsx` (`/account/billing`) — current plan card, "Manage in Stripe" button, "Cancel membership" dialog showing prorated refund preview.
- Route registrations in `src/App.tsx`.
- Admin pricing page: add two inputs for `stripe_price_lookup_monthly` / `stripe_price_lookup_annual` per tier.

## Stripe dashboard (manual, one-time)
User creates 3 products + monthly/annual prices in Stripe (test mode), assigns lookup keys like `accountabul_starter_monthly`, `accountabul_starter_annual`, etc., and pastes them into `/admin/pricing`. Webhook endpoint URL (the deployed `stripe-webhook` function) gets registered in Stripe → produces `STRIPE_WEBHOOK_SECRET` which we'll request as a secret.

## Packages to add
`@stripe/stripe-js`, `@stripe/react-stripe-js` (already present in repo — will reuse).

## Out of scope (call out, don't build)
- Migrating campaign one-time payment flows (already working in this project).
- Live mode — sandbox/test only until user verifies.
- Changing existing `profiles.membership_tier_id` consumers beyond pointing them at `subscriptions` for gating.

## Open question
Do you want me to also delete / disable the equivalent files in **Real Estate Explorer** after this lands, or leave that project untouched? (Default: leave it alone.)
