# Payments → Global Nav + Monetization Research Prompt

## Goal

Two separate deliverables in one pass:

1. **Surface Payments publicly** so anyone visiting the site can see it exists, but require sign-in to actually use it.
2. **Generate a research prompt** you can hand to another agent to figure out how we make money from the Payments product — focused on willingness-to-pay (not competitor benchmarking).

---

## Part 1 — Nav change (small, scoped)

### What changes

- **`src/components/Navigation.tsx`** (line 57): remove the `user ? [...] : []` wrapper so `Payments` always appears in `navItems`. Desktop nav, mobile drawer, and bottom tab bar all read from this same array, so a one-line change makes it visible everywhere.

- **`src/App.tsx`**: wrap the `/payments` route in `<RouteGuard requireAuth>` (or equivalent — match how `/portfolio` and `/dashboard` are gated). Logged-out users who click the nav land on `/auth?next=/payments` and bounce back after sign-in.

- Leave `/payments/history` and `/payments/:id` gated the same way they are today (auth-required).

### What does NOT change

- No edits to `Payments.tsx`, the composer, the rail cards, Stripe modal, or any edge function.
- No marketing landing page — per your answer, logged-out users just get the auth screen, not a public preview.
- No new database tables, no RLS changes.

### Why this matches what you said

You wanted Payments "shown to the public" in the nav, but also confirmed "u cant see it if you are not logged in" for the page itself. So the **link is global, the page is gated**. The nav entry acts as a discovery/marketing signal; the auth wall is the conversion point.

---

## Part 2 — Monetization research prompt

You said the swap mechanism likely stays free (we'd just pass through XRPL pathfinding for the cheapest route), and you want deep WTP research before locking in a fee model. Below is the prompt — copy and hand it to your research agent as-is.

> ### Research brief: monetization model for an XRPL-based payments product
>
> **Product context**
> We've built a payments app on top of the XRP Ledger. A user connects a wallet (Xaman on mainnet, faucet wallet on testnet) and can:
> - Send XRP or issued currencies (IOUs, MPTs) to any XRPL address
> - Pay in fiat via Stripe (off-ledger rail) where the recipient is settled in XRP
> - Eventually swap between assets using XRPL's native pathfinding (cheapest-quote routing across the on-ledger DEX and AMMs)
>
> Target users are individual senders, small businesses, and donors/creators. We are not a custodian — users keep their own keys.
>
> **Pricing assumptions we're starting from (challenge these)**
> 1. Swap/pathfinding will be **free** because XRPL already gives us the cheapest route at near-zero on-ledger cost. We don't want to be the expensive middleman on a feature the chain does for us.
> 2. Per-transaction fees on plain XRPL sends are the obvious lever, but we don't know what users will tolerate before they leave for Xaman, Sologenic, GemWallet, or just sending directly from their own wallet.
> 3. A monthly subscription (e.g. unlimited sends + premium features) might be more defensible than nickel-and-diming each transaction, but we have no data on whether users in this space pay subscriptions.
>
> **What we need you to figure out — primarily through willingness-to-pay research, not competitor pricing**
>
> 1. **WTP discovery method.** Recommend a concrete methodology for measuring willingness to pay for this product:
>    - Van Westendorp Price Sensitivity Meter? Gabor-Granger? Conjoint? Simple A/B price tests in onboarding?
>    - How many respondents do we need to get a directional signal vs a statistically meaningful one?
>    - Which method works best when the user base is small (early-stage) and crypto-native (skeptical of fees, allergic to subscriptions)?
>
> 2. **Survey/interview script.** Draft 8–12 questions we can run in user interviews and/or a typeform survey to surface:
>    - What they currently pay (in fees, time, friction) to send crypto
>    - Whether they'd pay per-transaction, monthly, or "only when something fancy happens" (recurring, scheduling, invoicing, batch)
>    - Their reservation price ranges for each model
>    - What features would justify a subscription
>
> 3. **Segment hypotheses.** Suggest 3–5 user segments (e.g. casual senders, crypto-native power users, small-biz invoicing, creators receiving tips, OTC traders) and how WTP likely differs by segment. We want to know which segment to test pricing on first.
>
> 4. **Pricing model shortlist.** Based on the above, give us 2–3 monetization models worth A/B testing first, with the rationale for each:
>    - Per-transaction (flat XRP, flat USD, or %?)
>    - Subscription tiers (what gates each tier?)
>    - Freemium with paid premium features (which features?)
>    - Hybrid (e.g. free up to N sends/month, then per-tx)
>    - Explicitly call out which models you think will *fail* with this audience and why.
>
> 5. **Validation plan.** A 30-day plan to validate the top model: how to recruit ~20–30 target users, what to test, what success looks like (% who'd pay, average WTP, churn signal), and the kill criteria.
>
> **Out of scope for this brief**
> - Don't deep-dive competitor pricing tables — we'll do that separately.
> - Don't design the actual paywall UI.
> - Don't recommend a specific number ($X per tx) until WTP data justifies it.
>
> **Deliverable format**
> A markdown doc with: methodology recommendation, survey script, segment hypotheses, model shortlist with rationale, and a 30-day validation plan. ~1500–2500 words.

---

## Out of scope for this build

- Actually implementing fees, fee tiers, or a subscription.
- Building the WTP survey or a paywall.
- Editing the existing Stripe rail or any edge functions.
- A public marketing page at `/payments` for logged-out users.

Once you've run the research with your other agent and have a chosen model, we'll come back and plan the fee/subscription implementation as a separate scoped change.
