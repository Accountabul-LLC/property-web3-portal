# Vendor System Integration Handoff
Date: 2026-05-28
Branch: main
Commits: 3 new commits (Phases 2–4)

---

## What Was Done

### Phase 1 — Verification (no code changes)
- Confirmed `vendor_profiles` columns `ein_full`, `industry`, `tax_exempt`, `tax_exempt_ein` already exist in migration `20260528014516_0891e42f-0f32-4f93-ad65-39b172878f7d.sql`. No new migration needed.
- Confirmed `credential_catalog` has `credential_key = 'vendor'` in migration `20260526020000_verified_vendor_network.sql`.
- Confirmed `src/App.tsx` had `/auth/vendor` and `/vendor/onboarding` but was missing `/vendor`, `/vendor/status`, `/vendor/dashboard`.
- Confirmed `src/lib/vendorNetwork.ts` used wrong credential key `'VENDOR_MARKETPLACE_APPROVED'`.
- Confirmed `types.ts` vendor_profiles row type already included all needed columns.

### Phase 2 — Low-risk additions (commit: 5eb5b29)
Files added:
- `src/lib/vendorFlow.ts` — canonical vendor routing and status utilities copied from Codex branch
- `src/components/vendor/VendorBenefitsCard.tsx` — reusable benefits card (moved from Codex `src/components/vendors/` to main's `src/components/vendor/` convention)
- `src/pages/Vendor.tsx` — public vendor landing page at `/vendor`
- `src/pages/VendorStatus.tsx` — application status page at `/vendor/status` (imports from `vendorFlow.ts` and `useVendorApplication`)

Files modified:
- `src/App.tsx` — added `Navigate` import, added `Vendor`, `VendorStatus`, `VendorDashboard` lazy imports, registered new routes `/vendor`, `/vendor/status`, `/vendor/dashboard`, and legacy redirect routes `/vendors`, `/vendors/apply`, `/vendors/status`, `/vendors/dashboard`

### Phase 3 — State logic unification (commit: 855eb93)
Files modified:
- `src/lib/vendorNetwork.ts` — fixed `VERIFIED_VENDOR_CREDENTIAL_KEY` from `'VENDOR_MARKETPLACE_APPROVED'` to `'vendor'` (HIGHEST PRIORITY FIX — was causing all credential lookups to miss)

Files added:
- `src/hooks/useVendorApplication.ts` — unified vendor application state hook sourced from `vendorFlow.ts`, with `walletsLoading ?? false` safety guard applied

No migration created — columns already existed.

### Phase 4 — Dashboard and admin alignment (commit: ebadf3a)
Files added:
- `src/pages/VendorDashboard.tsx` — vendor dashboard at `/vendor/dashboard`, expanded from Codex version to include `VendorNetworkCard` (main's existing component, previously only used in Dashboard.tsx) and `VendorBenefitsCard`

Files modified:
- `src/lib/vendorCta.ts` — updated `resolveVendorCta` to use `getVendorNextRoute` and `normalizeVendorStatus` from `vendorFlow.ts` for routing decisions instead of duplicating logic. Function signature unchanged.
- `src/components/admin/VendorCRMPanel.tsx` — added TODO comment on `runAction`: the `review-credential-application` edge function updates `credential_applications.status` but does not currently sync `vendor_profiles.verification_status`. This is a separate edge-function task.

---

## What Was Intentionally NOT Done

- **`src/pages/VendorOnboarding.tsx` was not touched.** The plan specifies this file needs a full rebuild (combining main's data collection with Codex's application submit logic). That is a separate task — do not attempt a merge. Leave it as-is until the rebuild task is scoped and designed.

---

## One Remaining Rebuild Needed

**VendorOnboarding.tsx rebuild** — Combine:
- Main's data collection form (EIN, industry, tax fields, document upload, vendor credentials)
- Codex's application submit flow (`submitVendorApplication` from `useVendorApplication`, status-aware redirects, `getVendorNextRoute`)

Current `VendorOnboarding.tsx` on main collects all the data but submits via its own ad-hoc flow. After the rebuild, it should call `useVendorApplication().submitVendorApplication()` after the form is complete and redirect using `getVendorNextRoute`.

---

## TypeScript Notes

- `VendorDashboard.tsx` imports `useKycStatus` — confirm the hook returns `isApproved: boolean`. If the shape differs, update the destructuring.
- `vendorCta.ts` normalizes `vendorProfile?.verification_status` through `normalizeVendorStatus`. The `verification_status` field on `VendorProfile` uses different enum values than `VendorApplicationStatus` (e.g., `'not_requested'`, `'requested'`, `'verified'`). The `normalizeVendorStatus` function maps unknown values to `'unknown'`, which `getVendorNextRoute` routes to `/vendor/onboarding` — safe fallback behavior.
- `VendorNetworkCard` in `VendorDashboard.tsx` uses `actionLoading={false}` for now. Wire up real loading state when the dashboard's vendor action handlers are implemented.

---

## DB Migration File

No new migration was created. All required columns (`ein_full`, `industry`, `tax_exempt`, `tax_exempt_ein`) already exist in:
`supabase/migrations/20260528014516_0891e42f-0f32-4f93-ad65-39b172878f7d.sql`

---

## Git Status at End of Task

Branch: main
Ahead of origin/main by 3 commits.
Working tree: clean (no staged or unstaged changes to tracked files).
Untracked: `.claude/` skill/command files (pre-existing, not part of this task).

Commits added by this task:
- ebadf3a feat(vendor): Phase 4 — add VendorDashboard, update vendorCta routing, note CRM TODO
- 855eb93 fix(vendor): Phase 3 — fix credential key and add useVendorApplication hook
- 5eb5b29 feat(vendor): Phase 2 — add vendorFlow, VendorBenefitsCard, Vendor, VendorStatus pages and routes
