-- Accountabul Verified Vendor Network v1 foundation.
-- Extends vendor_profiles with public directory fields and creates vendor_leads.

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS public_profile_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_headline text,
  ADD COLUMN IF NOT EXISTS business_address_city text,
  ADD COLUMN IF NOT EXISTS business_address_state text,
  ADD COLUMN IF NOT EXISTS business_address_zip text,
  ADD COLUMN IF NOT EXISTS years_in_business integer,
  ADD COLUMN IF NOT EXISTS verification_tier text NOT NULL DEFAULT 'unverified';

ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_years_in_business_check
  CHECK (years_in_business IS NULL OR years_in_business >= 0);

DO $$
BEGIN
  ALTER TABLE public.vendor_profiles
    DROP CONSTRAINT IF EXISTS vendor_profiles_verification_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_verification_status_check
  CHECK (
    verification_status IN (
      'not_requested',
      'requested',
      'under_review',
      'more_info_needed',
      'approved',
      'verified',
      'denied',
      'suspended'
    )
  );

ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_verification_tier_check
  CHECK (
    verification_tier IN (
      'unverified',
      'business_verified',
      'credential_verified',
      'platform_vouched'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_profiles_slug
  ON public.vendor_profiles (slug);

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_public_profile_enabled
  ON public.vendor_profiles (public_profile_enabled);

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_verification_tier
  ON public.vendor_profiles (verification_tier);

DROP POLICY IF EXISTS "Public can read verified vendor profiles" ON public.vendor_profiles;
CREATE POLICY "Public can read verified vendor profiles"
  ON public.vendor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    verification_status = 'verified'
    AND public_profile_enabled = true
  );

CREATE TABLE IF NOT EXISTS public.vendor_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  service_needed text NOT NULL,
  message text NOT NULL,
  source text NOT NULL DEFAULT 'vendor_directory',
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_leads_vendor_profile_id
  ON public.vendor_leads (vendor_profile_id);

CREATE INDEX IF NOT EXISTS idx_vendor_leads_status
  ON public.vendor_leads (status);

CREATE INDEX IF NOT EXISTS idx_vendor_leads_created_at
  ON public.vendor_leads (created_at DESC);

ALTER TABLE public.vendor_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert vendor leads" ON public.vendor_leads;
CREATE POLICY "Anyone can insert vendor leads"
  ON public.vendor_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Vendors can read own leads" ON public.vendor_leads;
CREATE POLICY "Vendors can read own leads"
  ON public.vendor_leads
  FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT id
      FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can update own leads" ON public.vendor_leads;
CREATE POLICY "Vendors can update own leads"
  ON public.vendor_leads
  FOR UPDATE
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT id
      FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT id
      FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can read all vendor leads" ON public.vendor_leads;
CREATE POLICY "Admins can read all vendor leads"
  ON public.vendor_leads
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );

DROP POLICY IF EXISTS "Admins can update all vendor leads" ON public.vendor_leads;
CREATE POLICY "Admins can update all vendor leads"
  ON public.vendor_leads
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );

DROP TRIGGER IF EXISTS update_vendor_leads_updated_at ON public.vendor_leads;
CREATE TRIGGER update_vendor_leads_updated_at
  BEFORE UPDATE ON public.vendor_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP VIEW IF EXISTS public.vendor_public_profiles;
CREATE VIEW public.vendor_public_profiles AS
SELECT
  id,
  slug,
  company_name,
  logo_url,
  profile_headline,
  business_email,
  business_phone,
  website_url,
  industry_category,
  business_description,
  service_areas,
  business_address_city,
  business_address_state,
  business_address_zip,
  years_in_business,
  verification_tier,
  public_profile_enabled,
  verification_status
FROM public.vendor_profiles
WHERE verification_status = 'verified'
  AND public_profile_enabled = true;
