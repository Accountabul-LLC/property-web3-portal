## Apply vendor_network_v1_fix migration

Run the SQL in `supabase/migrations/20260530020000_vendor_network_v1_fix.sql` against project `gveavwqyrwqvafsnhnqc` via the migration tool. Types.ts regenerates automatically after the migration runs.

### What the migration changes

**`vendor_profiles`**
- Replaces `verification_tier` CHECK to allow: `unverified`, `business_verified`, `credential_verified`, `platform_vouched` (was: basic/identity/licensed/insured/platform_vouched).

**`vendor_leads`**
- Renames `contact_name` → `requester_name`, `contact_email` → `requester_email`, `contact_phone` → `requester_phone` (matches frontend inserts).
- Adds `service_needed`, `property_address`, `source` (default `'vendor_directory'`).
- Replaces `status` CHECK to: `new`, `contacted`, `closed`, `spam`, `archived` (matches dashboard).
- Drops unused `source_url`.

All statements are idempotent (`IF EXISTS` / `IF NOT EXISTS`). No app code changes.
