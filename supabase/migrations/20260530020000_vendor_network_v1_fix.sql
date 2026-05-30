-- vendor_network_v1_fix.sql
-- Corrects schema mismatches introduced by the initial Lovable migration.
-- Safe to re-run: all statements are idempotent.

-- ── 1. Fix verification_tier CHECK constraint ─────────────────────────────
-- Lovable used: basic | identity | licensed | insured | platform_vouched
-- Code uses:    unverified | business_verified | credential_verified | platform_vouched

ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_verification_tier_check;

ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_verification_tier_check
  CHECK (
    verification_tier IS NULL OR
    verification_tier IN (
      'unverified',
      'business_verified',
      'credential_verified',
      'platform_vouched'
    )
  );

-- ── 2. Rename vendor_leads contact columns to requester_* ─────────────────
-- Lovable used: contact_name / contact_email / contact_phone
-- Code inserts: requester_name / requester_email / requester_phone

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vendor_leads'
      AND column_name  = 'contact_name'
  ) THEN
    ALTER TABLE public.vendor_leads RENAME COLUMN contact_name  TO requester_name;
    ALTER TABLE public.vendor_leads RENAME COLUMN contact_email TO requester_email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vendor_leads'
      AND column_name  = 'contact_phone'
  ) THEN
    ALTER TABLE public.vendor_leads RENAME COLUMN contact_phone TO requester_phone;
  END IF;
END $$;

-- ── 3. Add missing columns to vendor_leads ────────────────────────────────
-- Code also inserts: service_needed, property_address, source

ALTER TABLE public.vendor_leads
  ADD COLUMN IF NOT EXISTS service_needed   TEXT,
  ADD COLUMN IF NOT EXISTS property_address TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'vendor_directory';

-- ── 4. Fix status CHECK constraint ───────────────────────────────────────
-- Lovable used: new | contacted | qualified | won | lost | spam
-- Dashboard uses: new | contacted | closed | spam | archived

ALTER TABLE public.vendor_leads
  DROP CONSTRAINT IF EXISTS vendor_leads_status_check;

ALTER TABLE public.vendor_leads
  ADD CONSTRAINT vendor_leads_status_check
  CHECK (status IN ('new', 'contacted', 'closed', 'spam', 'archived'));

-- ── 5. Remove source_url (not used by any frontend code) ─────────────────
ALTER TABLE public.vendor_leads
  DROP COLUMN IF EXISTS source_url;

-- ── 6. Remove vendor_notes (not used by any frontend code) ───────────────
-- Keep this commented out — harmless extra column, no need to drop.
-- ALTER TABLE public.vendor_leads DROP COLUMN IF EXISTS vendor_notes;
