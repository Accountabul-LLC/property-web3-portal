## Goal
Add a "For Vendors" call-to-action on the landing page that funnels businesses into the existing vendor signup → onboarding flow. No new pages, no schema changes, no duplicate intake form.

## Scope

### 1. Landing page CTA (only code change)
- File: `src/pages/Index.tsx` (or the hero/CTA section component it uses).
- Add a vendor-focused CTA next to the existing "Start Tokenization" / "Explore Marketplace" buttons.
- Copy: short headline like "Are you a service provider or business?" with a button "Join the Vendor Network" → links to `/auth/vendor`.
- Style: matches existing 40px button standard and blue gradient design tokens.

### 2. Flow (no changes needed — already correct)
```
Landing → [Join the Vendor Network] → /auth/vendor (signup, email or Google)
       → /vendor/onboarding (captures company name, phone, industry, city,
                             service areas, bio, credentials)
       → /vendor/dashboard
```
- `/vendor/onboarding` already collects all the business info we discussed (company, phone, industry, city, service areas, bio, plus licensed/insured via the credentials section).
- Google OAuth signups land in the same `/vendor/onboarding` flow, so they fill the same info there — no extra step required.

### 3. Out of scope
- No new `/vendors/join` or intake page.
- No schema additions (`licensed_status`, `best_time_to_contact`, `serves_real_estate` skipped — licensing is already covered by the credentials section; the other two are not needed).
- No changes to `/auth/vendor` or `/vendor/onboarding`.
- No admin changes — vendors who sign up appear in the existing `/admin/vendors` panel automatically.

## Technical notes
- Single-file edit in the landing page. Reuses existing `Button` component and design tokens.
- Will verify the exact landing-page file (`Index.tsx` and its hero/CTA section) before editing.