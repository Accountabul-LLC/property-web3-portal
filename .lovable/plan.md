## Root causes

From the live network log and DB inspection:

1. **Save fails** — `vendor_profiles` save returns `PGRST204: Could not find the 'applicant_title' column`. The form/hook send columns that don't exist on the table, and use the wrong names for several that do:

   | Form sends | Actual DB column |
   |---|---|
   | `industry_category` | `industry` |
   | `business_description` | `vendor_bio` |
   | `public_profile_visible` | `public_profile_enabled` |
   | `applicant_title` | (missing) |
   | `service_areas` | (missing) |
   | `tax_exempt_number` | `tax_exempt_ein` |

2. **Logo shows URL instead of image** — `VendorProfileForm` only renders the uploaded URL inside an `<Input>` and never shows an `<img>` preview.

3. **"Check Status" button reloads the page** — it links to `/vendor/dashboard`. `VendorDashboard`'s redirect only looks at `vendorApplication?.status` (the credential application row), not at the vendor profile. This user has a vendor profile with `verification_status='requested'` but no credential application, so `normalizeVendorStatus(undefined) === 'none'` and the dashboard immediately bounces back to `/vendor/onboarding`.

## Plan

### 1. Database migration
Add the three missing columns to `vendor_profiles` so the form's full payload persists:
- `applicant_title text`
- `service_areas text`
- `tax_exempt_number text` (keep separate from existing `tax_exempt_ein`, which is a legacy EIN-format field)

No RLS changes needed (existing policies already cover the table).

### 2. Align column names in code
Update `useVendorProfile.ts` upsert payload and the `VendorProfileUpdate` / `VendorProfileRecord` types to use the real DB names:
- `industry_category` → `industry`
- `business_description` → `vendor_bio`
- `public_profile_visible` → `public_profile_enabled`

Update `VendorProfileForm.tsx` form state keys to match, plus any read sites (`vendorNetwork.ts` helpers, vendor dashboard, public profile page) that reference the old names.

### 3. Logo preview
In `VendorProfileForm.tsx`, render an `<img>` thumbnail (rounded, ~64px) next to the Logo URL input whenever `form.logo_url` is set, with a small "Remove" button that clears it. Keep the URL input visible for manual paste.

### 4. Fix "Check Status" navigation
Two small fixes so the button actually lands on a useful page:
- In `VendorDashboard.tsx`, use the combined `status` from `useVendorApplication` (which already considers `vendorProfileStatus`) instead of `vendorApplication?.status` alone. Only redirect to `/vendor/onboarding` when the combined status is truly `none`.
- In `VendorOnboarding.tsx`, after a successful save toast, keep the user on the onboarding page (no auto-redirect) so they can see their saved values and the verification badge.

### 5. Verify
After build, on `/vendor/onboarding`:
- Save vendor profile → expect 200/204, toast "Vendor profile saved", row updated with new fields.
- Upload logo → expect a visible thumbnail preview.
- Click **Check Status** → expect to land on `/vendor/dashboard` showing the "Under review" state instead of bouncing.

### Files touched
- `supabase/migrations/<new>.sql` — add 3 columns
- `src/hooks/useVendorProfile.ts` — rename payload keys, add new fields
- `src/lib/vendorNetwork.ts` — update `VendorProfileRecord` type & helpers
- `src/components/vendor/VendorProfileForm.tsx` — rename form keys, add logo preview
- `src/pages/VendorDashboard.tsx` — use combined status for redirect
- `src/pages/VendorOnboarding.tsx` — remove post-save redirect (already navigates on submit; leave save-only flow on page)
- Any other reader of the renamed fields (e.g. `VendorPublicProfile.tsx`, `VendorCRMPanel.tsx`) — grep and patch.

### Out of scope
- Larger org+members refactor (already decided: keep current schema, fix mapping only).
- Profile-card auto-fill changes (covered in prior turn).