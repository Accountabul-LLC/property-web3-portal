## Goal
One canonical vendor route namespace: `/vendors/*`. Remove the singular `/vendor/*` routes and all references, while preserving working functionality.

## Final route map (in `src/App.tsx`)

Canonical (kept):
- `/vendors` → `VendorsDirectory` (public marketplace)
- `/vendors/apply` → `VendorOnboarding` (was `/vendor/onboarding`)
- `/vendors/dashboard` → `VendorDashboard` (was `/vendor/dashboard`)
- `/vendors/status` → `VendorDashboard` (status surface lives in the dashboard today)
- `/vendors/:slug` → `VendorPublicProfile` (was `/vendor/:slug`)
- `/auth/vendor` → `AuthVendor` (auth path stays; not a vendor content route)
- `/admin/vendors` → `AdminVendors` (admin path stays)

Removed entirely (no redirect — duplicates per request):
- `/vendor` (was redirect to `/vendors`)
- `/vendor/:slug`
- `/vendor/onboarding`
- `/vendor/dashboard`
- `/vendor/status`
- `/vendors/join` (alias of `/auth/vendor`)

Note: removing without redirects means any external link to the old paths will 404. If you'd prefer to keep one-line `<Navigate>` redirects for safety, say so and I'll add them back.

## Code changes

1. **`src/App.tsx`** — replace the vendor route block with the 5 canonical routes above; delete every singular `/vendor/*` route and the `/vendors/join|apply|status|dashboard` aliases.

2. **`src/lib/vendorFlow.ts`** — update constants:
   - `VENDOR_ONBOARDING_ROUTE = '/vendors/apply'`
   - `VENDOR_DASHBOARD_ROUTE = '/vendors/dashboard'`

3. **`src/lib/vendorNetwork.ts`** — `return '/vendors/${slug}'`.

4. **Page-internal links / navigates** (rewrite `/vendor/...` → `/vendors/...`):
   - `src/pages/VendorOnboarding.tsx` (path prop, navigates, links, primary/secondary hrefs)
   - `src/pages/VendorDashboard.tsx` (path prop, navigates, link to edit application)
   - `src/pages/VendorPublicProfile.tsx` (path prop, internal shop links)
   - `src/pages/Dashboard.tsx` (vendor dashboard/onboarding href)
   - `src/pages/AuthVendor.tsx` (`redirectAfterSignup`/`redirectAfterLogin` → `/vendors/apply`)
   - `src/components/ProfessionalsSection.tsx` (link to onboarding)
   - `src/components/Navigation.tsx` (vendor profile nav links)
   - `src/components/RouteSeo.tsx` (rekey `/vendor/onboarding` → `/vendors/apply`, `/vendor/dashboard` → `/vendors/dashboard`, update `startsWith('/vendor/')` to `'/vendors/'`)

5. **No component deletions.** Each canonical route still maps to exactly one existing page component (`VendorsDirectory`, `VendorOnboarding`, `VendorDashboard`, `VendorPublicProfile`, `AuthVendor`, `AdminVendors`). The build-time duplicate-route/component check will then pass cleanly.

## Verification
- Run the duplicate-route check (already wired into `vite.config.ts`).
- Click-through: `/vendors` → Apply → `/vendors/apply` → after submit lands on `/vendors/dashboard`; profile link opens `/vendors/:slug`; AuthVendor signup lands on `/vendors/apply`.

## Out of scope
- No schema changes, no admin changes, no component consolidation (each page is already a single component — no real duplication in code, only in routing).
