## Current vendor routes (6)

| Route | File | Purpose | Verdict |
|---|---|---|---|
| `/vendor` | Vendor.tsx (102) | Marketing landing for vendor program | **Remove** — duplicates `/vendors` directory hero + `/auth/vendor` CTA |
| `/vendor/onboarding` | VendorOnboarding.tsx (443) | Application form / profile completion | **Keep** |
| `/vendor/status` | VendorStatus.tsx (159) | Pending-review status screen | **Remove** — fold into VendorDashboard as a status banner |
| `/vendor/dashboard` | VendorDashboard.tsx (358) | Active vendor CRM (leads, profile) | **Keep** (becomes status-aware) |
| `/vendors` | VendorsDirectory.tsx (349) | Public verified vendor directory | **Keep** |
| `/vendor/:slug` | VendorPublicProfile.tsx (423) | Public vendor profile + lead form | **Keep** |

## Why remove these two

**`/vendor`** is a thin marketing page. The same audience hits `/vendors` (public directory) or `/auth/vendor` (signup). It adds a hop without unique content. The Dashboard quick-links button to "Vendor Hub" can point to `/vendors` instead.

**`/vendor/status`** mirrors what `/vendor/dashboard` should show when the vendor isn't yet verified. Today VendorDashboard already redirects unverified users to `/vendor/onboarding`; we'll switch it to render a status panel inline (pending / rejected / expired states) so there's one home for vendors regardless of stage.

## Plan

1. **Delete pages**: `src/pages/Vendor.tsx`, `src/pages/VendorStatus.tsx`.
2. **App.tsx**: remove the two `Route`s and the two lazy imports. Add legacy redirects:
   - `/vendor` → `/vendors`
   - `/vendor/status` → `/vendor/dashboard`
   (Keep existing `/vendors/status` → `/vendor/dashboard` redirect; update target.)
3. **VendorDashboard.tsx**: instead of redirecting unverified users away, render a status card at the top (uses `useVendorApplication`) covering pending / under review / rejected / expired. Verified users see the existing CRM UI unchanged.
4. **Update internal links** away from removed routes:
   - `Dashboard.tsx` quick-links: drop the `/vendor` button; keep onboarding, dashboard, directory.
   - `VendorOnboarding.tsx`: replace `navigate('/vendor/status')` with `navigate('/vendor/dashboard')` (2 spots).
   - `VendorStatus.tsx` is gone, so its links disappear with it.
   - `vendorFlow.ts`: point `VENDOR_STATUS_ROUTE` consumers at `/vendor/dashboard` (or remove the constant if unused after refactor).
5. **No DB / RLS / edge-function changes.** Pure frontend route consolidation.

## Result

4 vendor routes, each with a single clear job:
- `/vendors` — public directory
- `/vendor/:slug` — public profile
- `/vendor/onboarding` — apply / edit profile
- `/vendor/dashboard` — vendor home (status when pending, CRM when verified)
