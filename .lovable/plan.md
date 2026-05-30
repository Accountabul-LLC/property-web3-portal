# Vendor Network v1 — Database Migration

The migration file referenced (`20260529093000_vendor_network_v1.sql`) is not in the repo, so I'll author it from the spec and apply it to project `gveavwqyrwqvafsnhnqc`. No app code will change.

## 1. Extend `vendor_profiles`

Add columns (all nullable / safe defaults so existing rows survive):
- `slug TEXT UNIQUE` (case-insensitive uniqueness via unique index on `lower(slug)`)
- `public_profile_enabled BOOLEAN NOT NULL DEFAULT false`
- `profile_headline TEXT`
- `website_url TEXT`
- `business_address_city TEXT`
- `business_address_state TEXT`
- `business_address_zip TEXT`
- `years_in_business INTEGER`
- `profile_completed_at TIMESTAMPTZ`
- `verification_tier TEXT` with CHECK in (`basic`,`identity`,`licensed`,`insured`,`platform_vouched`)

Add public read RLS policy:
- anon + authenticated can `SELECT` rows where `verification_status = 'verified' AND public_profile_enabled = true`
- Existing owner/admin policies untouched

## 2. Create `vendor_leads` table

Columns: `id uuid pk`, `vendor_profile_id uuid fk -> vendor_profiles(id) on delete cascade`, `contact_name text not null`, `contact_email text not null`, `contact_phone text`, `message text not null`, `source_url text`, `status text not null default 'new'` (CHECK in `new`,`contacted`,`qualified`,`won`,`lost`,`spam`), `vendor_notes text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.

Indexes: `(vendor_profile_id)`, `(status)`, `(created_at desc)`.

Trigger: `BEFORE UPDATE` → `public.set_updated_at()` (already exists).

Grants:
- `GRANT INSERT ON public.vendor_leads TO anon, authenticated`
- `GRANT SELECT, UPDATE ON public.vendor_leads TO authenticated`
- `GRANT ALL ON public.vendor_leads TO service_role`

RLS policies:
- **Insert (anon + authenticated):** allow insert when target `vendor_profile_id` belongs to a vendor that is `verified` AND `public_profile_enabled` (prevents lead-spamming hidden vendors)
- **Select (authenticated):** vendor sees rows where `vendor_profile_id` maps to their own `vendor_profiles.user_id = auth.uid()`
- **Update (authenticated):** same ownership check (lets vendor update `status` / `vendor_notes`)
- **Admin all:** `public.has_role(auth.uid(), 'admin')` full access (select/update/delete)

## 3. Apply

Run via the migration tool against `gveavwqyrwqvafsnhnqc`. After apply, run the Supabase linter and report any new findings.

## Technical notes
- Uses existing `public.set_updated_at()` and `public.has_role()` helpers — no new functions.
- All `ADD COLUMN` statements use `IF NOT EXISTS` so re-running is safe.
- No data backfill needed; `public_profile_enabled` defaults to false so no vendor is exposed until they opt in.
