-- vendor_network_v1_fix
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

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_leads' AND column_name = 'contact_name'
  ) THEN
    ALTER TABLE public.vendor_leads RENAME COLUMN contact_name  TO requester_name;
    ALTER TABLE public.vendor_leads RENAME COLUMN contact_email TO requester_email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_leads' AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE public.vendor_leads RENAME COLUMN contact_phone TO requester_phone;
  END IF;
END $$;

ALTER TABLE public.vendor_leads
  ADD COLUMN IF NOT EXISTS service_needed   TEXT,
  ADD COLUMN IF NOT EXISTS property_address TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'vendor_directory';

ALTER TABLE public.vendor_leads
  DROP CONSTRAINT IF EXISTS vendor_leads_status_check;

ALTER TABLE public.vendor_leads
  ADD CONSTRAINT vendor_leads_status_check
  CHECK (status IN ('new', 'contacted', 'closed', 'spam', 'archived'));

ALTER TABLE public.vendor_leads
  DROP COLUMN IF EXISTS source_url;