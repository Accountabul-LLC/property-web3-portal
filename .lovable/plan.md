## Goal

Make "Request Verified Vendor Status" on the Professionals page route intelligently based on who is signed in, and give vendors a dedicated, state-aware onboarding path. The verified badge unlocks only after KYC passes **and** a paid membership is active.

## New routes

```
/auth/individual    individual signup + login (default)
/auth/business      business signup + login (sets account_type='business')
/auth/vendor        vendor-intent signup + login (business + vendor onboarding redirect)
/vendor/onboarding  3-step gate: business profile → KYC → membership payment
```

Keep `/auth` as a thin redirect to `/auth/individual` for backward compatibility (the existing `?tab=admin` admin login stays where it is).

## Smart CTA on /professionals

The "Request Verified Vendor Status" button decides where to send the user based on session + profile state:

| State | Action |
|---|---|
| Not signed in | → `/auth/vendor` (signup with vendor intent stored in location.state) |
| Signed in, `account_type='individual'` | Modal: "Vendor status requires a business account. Upgrade?" → on confirm, flip `profiles.account_type='business'` then → `/vendor/onboarding` |
| Signed in, `account_type='business'`, vendor not verified | → `/vendor/onboarding` (resumes at the first incomplete step) |
| Signed in, vendor verified | → `/dashboard` with a toast "You're already a verified vendor" (or `/portfolio` if that's the verified vendor's home — see open question) |

The same logic is reused anywhere else we link to vendor signup (e.g. the `ProfessionalsSection` hero CTA, footer links).

## /vendor/onboarding page

A single page with three numbered steps and a progress indicator. Each step shows status (todo / in-progress / done) and unlocks the next.

1. **Business profile** — embed the existing `VendorProfileForm`. Done when `vendor_profiles.company_name` and required CRM fields are saved.
2. **Identity verification (KYC)** — link to `/kyc`; reflects `get_kyc_status` RPC. Done when status = `approved`.
3. **Vendor membership** — shows the vendor tier from `membership_tiers` and routes to `/pricing` (Stripe checkout) with `?tier=vendor&return=/vendor/onboarding`. Done when `profiles.membership_tier_id` points to the vendor tier and Stripe reports active.

When all three are done, the page calls the existing credential flow to request the `vendor` credential (auto-issued because all prerequisites are met) and shows a success state with a link to the dashboard.

## Auth pages

Three files share one underlying form component (`AuthForm`) but differ in copy, default tab (signup vs login), default `accountType`, and post-signup redirect:

- `/auth/individual` → after signup, redirect to `nextPath ?? /dashboard`
- `/auth/business` → forces `accountType='business'`, requires `companyName`, redirect to `/dashboard`
- `/auth/vendor` → forces `accountType='business'`, requires `companyName`, redirect to `/vendor/onboarding`

All three keep email/password + Google OAuth, password reset link, and the existing `RouteSeo` titles.

## Files to add

- `src/pages/AuthIndividual.tsx`
- `src/pages/AuthBusiness.tsx`
- `src/pages/AuthVendor.tsx`
- `src/components/auth/AuthForm.tsx` (shared form, extracted from current `Auth.tsx`)
- `src/pages/VendorOnboarding.tsx`
- `src/lib/vendorCta.ts` — `resolveVendorCta(user, profile, vendorProfile)` returning `{ to, action }` used by the Professionals CTA

## Files to edit

- `src/App.tsx` — add 4 new routes, keep `/auth` as a redirect to `/auth/individual`
- `src/components/ProfessionalsSection.tsx` — replace the static `Link to="/auth?mode=signup&intent=vendor"` with a button that calls `resolveVendorCta` and either navigates or opens the upgrade modal
- `src/pages/Auth.tsx` — becomes a `<Navigate to="/auth/individual" replace />` shim (keeps `?tab=admin` working by forwarding the query)
- `ROSETTA.md` — append agent note describing the new vendor flow

## Data / backend

No schema changes required — we already have `profiles.account_type`, `vendor_profiles`, `kyc_cases`, `membership_tiers`, and the `vendor` credential. We only need:

- A small client helper that flips `profiles.account_type` to `business` when an individual confirms the upgrade modal (RLS already allows the user to update their own profile).
- Confirm a `vendor` row exists in `membership_tiers` (read-only check; if missing, surface a clear "Vendor tier not yet configured" message rather than silently failing).

## Out of scope

- Building the Stripe vendor tier itself (we reuse whatever `/pricing` already does)
- Admin verified-vendor review queue UI (already covered by `docs/VENDOR_NETWORK_PLAN.md` / `AdminVendors`)
- Changing the existing credential review or KYC flows

## Open question for build time

Does a verified vendor land on `/dashboard` or on a vendor-specific portfolio page? If the latter doesn't exist yet, I'll send them to `/dashboard` and we can swap the destination in one place (`resolveVendorCta`) later.
