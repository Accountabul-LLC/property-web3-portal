# Merge Vendor and Business Auth

## Why
`/auth/vendor` and `/auth/business` are functionally identical at the auth layer — both create an `account_type = 'business'` profile and require a company name. The only differences are copy, icon, and the post-signup redirect. A vendor is just a business that also wants to join the verified vendor network, so there's no reason to maintain two auth pages.

## End State
- One business auth route: `/auth/business`
- A checkbox on the signup form: **"Also apply to join the verified vendor network"**
  - Checked → after signup, redirect to `/vendors/apply`
  - Unchecked → after signup, redirect to `/dashboard`
- `/auth/vendor` route, page file, and all internal links removed (no redirect — old URL will 404)
- `/auth/individual` stays as-is (genuinely different account type)

## Changes

### 1. `src/components/auth/AuthForm.tsx`
- Drop the `'vendor'` value from `AuthFormVariant` (keep `'individual' | 'business'`)
- Remove `Store` icon and the vendor entry from `VARIANT_ICON`
- Add an optional `showVendorOptIn?: boolean` prop and a new `vendorRedirect?: string` prop
- When `showVendorOptIn` is true and variant is `'business'`, render a checkbox under the company-name field: "Also apply to join the verified vendor network"
- On successful signup, if the box is checked, navigate to `vendorRedirect` (default `/vendors/apply`) instead of `redirectAfterSignup`
- Remove the vendor entry from `otherVariantLinks` (only Individual ↔ Business cross-links remain)

### 2. `src/pages/AuthBusiness.tsx`
- Pass `showVendorOptIn` and keep `redirectAfterSignup="/dashboard"`
- Update subtitle to mention vendor option, e.g. "Tokenize properties, manage your entity, and optionally join the verified vendor network."

### 3. `src/App.tsx`
- Remove the `AuthVendor` lazy import and the `<Route path="/auth/vendor" ... />` line

### 4. `src/pages/AuthVendor.tsx`
- Delete the file

### 5. Update inbound links to point at `/auth/business`
- `src/pages/VendorsDirectory.tsx` (2 places): `/auth/vendor` → `/auth/business`
- `src/components/HeroSection.tsx` (1 place): `/auth/vendor` → `/auth/business`

### 6. Verification
- `rg "auth/vendor"` returns nothing
- `rg "AuthVendor"` returns nothing
- Build/duplicate-route check passes
- Manually load `/auth/business` and confirm the new checkbox renders and toggles the post-signup redirect

## Out of Scope
- No DB schema changes (vendor network membership is tracked separately via `/vendors/apply`, not on `profiles`)
- No changes to `/auth/individual`, `/vendors/*`, `/admin/vendors`, or the vendor onboarding flow itself
- No changes to existing accounts — anyone who previously signed up at `/auth/vendor` is already a business account and can apply to the vendor network from the dashboard or `/vendors/apply` directly
