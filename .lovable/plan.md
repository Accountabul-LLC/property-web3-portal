# Vendor Intake Form + Admin CRM Tab

Reuse the existing `vendor_leads` table and the `/admin/vendors` page rather than creating parallel infrastructure. Intake submissions are flagged via `source = 'intake_join'` and stored without a vendor profile.

## 1. Public intake page — `/vendors/join`

New file: `src/pages/VendorJoin.tsx` (route added to `src/App.tsx`). Linked from Navigation, Footer, and a "Join the Network" CTA on `/vendors`.

Single-column form (mobile-first, matches existing brand: dark/light, blue gradients, 40px buttons, Sonner toasts), validated with zod.

**Required**

- Full Name
- Business Name
- Phone Number
- Email Address
- City / Service Area
- Occupation / Trade
- Licensed or Insured Status (radio: Licensed, Insured, Both, Neither)
- Best Time to Contact You (select: Morning / Afternoon / Evening / Anytime)

**Optional**

- Type of Business or Services Offered (text)
- Do you currently serve real estate investors, landlords, or property owners? (Yes / No / Sometimes)
- Short description of what you do (textarea, 1000 char)

**Submit button:** "Submit"

**Confirmation dialog after success:**

> Thank you. The form has been submitted. A member of the Accountabul team will review your details and give you a call within the next 7 days.
>
> Would you like to also create a business account with us to track your application and unlock vendor tools?
> [Create Business Account → `/auth/vendor`] [No thanks]

No auth required to submit. Honeypot + simple rate-limit guard (one submit per minute per IP via supabase function) — optional, deferred unless asked.

## 2. Data model — extend `vendor_leads`

One migration (adds columns nullable so existing customer-inquiry rows are unaffected; makes `vendor_profile_id` and `message` nullable for intake rows; adds new statuses).

New columns:

- `business_name text`
- `city_service_area text`
- `occupation text`
- `licensed_status text` (Licensed | Insured | Both | Neither)
- `best_time_to_contact text`
- `serves_real_estate text` (Yes | No | Sometimes)
- `service_description text`
- `internal_notes text` (admin-only notes, distinct from existing `vendor_notes` used by vendor users)
- `follow_up_date date`
- `assigned_admin_id uuid` (nullable, future use)

Status check constraint expanded to: `new | contacted | interested | not_interested | approved | rejected | closed | spam | archived` (keeps old values for back-compat).

Source values: existing `vendor_directory` (customer → vendor) + new `intake_join` (prospective vendor → Accountabul).

**RLS additions**

- New INSERT policy: `anon` and `authenticated` may insert rows where `source = 'intake_join'` AND `vendor_profile_id IS NULL`.
- Existing admin-all policy already covers read/update/delete of intake rows.

## 3. Admin CRM — new tab in `/admin/vendors`

Extend `src/pages/AdminVendors.tsx` (or its panel `src/components/admin/VendorCRMPanel.tsx`) with tabs:

- **Vendors** (existing list of vendor profiles / signups)
- **Customer Leads** (existing per-vendor inquiries, `source = 'vendor_directory'`)
- **Intake Leads** (new, `source = 'intake_join'`) — the focus here.

Intake Leads tab provides:

- Table columns: Submitted, Full Name, Business, City, Occupation, Licensed, Best Time, Status, Follow-up.
- Filters: status (multi), city (text), occupation (text), date range.
- Row click → side drawer with full details, internal notes editor, status dropdown, follow-up date picker, and a timeline of `updated_at` changes.
- Status colors via existing badge variants.
- CSV export (client-side) of current filtered rows.

New hook: `src/hooks/useVendorIntakeLeads.ts` (React Query, 15s staleTime, follows project conventions). Reuse Sonner for save toasts.

## 4. Files touched

- `supabase/migrations/<ts>_vendor_intake_extend.sql` — schema + RLS.
- `src/pages/VendorJoin.tsx` — new.
- `src/App.tsx` — add `/vendors/join` route.
- `src/components/Navigation.tsx`, `src/components/Footer.tsx` — add link.
- `src/pages/VendorsDirectory.tsx` — "Join the Network" CTA.
- `src/pages/AdminVendors.tsx` and/or `src/components/admin/VendorCRMPanel.tsx` — Intake Leads tab.
- `src/hooks/useVendorIntakeLeads.ts` — new hook.
- Types regenerate automatically after migration.

## Technical notes

- Validation: zod schema mirrored in client + edge-function-free direct insert (RLS gates it).
- Phone/email stored as text with the existing length + format check constraints; we'll add a similar length cap (≤120) for new text columns.
- `vendor_profile_id` made nullable: existing FK + cascade stays; intake rows simply have NULL.
- No XRPL, payments, or AI changes.

## Out of scope (ask if wanted)

- Email/SMS notification to admins on new intake submission.
- Auto-account-creation flow when user clicks "Create Business Account" (currently routes to existing `/auth/vendor`).
- Audit trail table for status changes (could reuse `updated_at` only for v1).