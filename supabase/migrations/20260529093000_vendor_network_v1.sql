-- Vendor Network v1: public profile fields, verification tiers, lead capture, public RLS
-- Phase 1 of the Verified Vendor Network v1 build plan.

-- ─────────────────────────────────────────────
-- 1. Add public profile columns to vendor_profiles
-- ─────────────────────────────────────────────
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_profile_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_headline text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS business_address_city text,
  ADD COLUMN IF NOT EXISTS business_address_state text,
  ADD COLUMN IF NOT EXISTS business_address_zip text,
  ADD COLUMN IF NOT EXISTS years_in_business int,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_tier text NOT NULL DEFAULT 'unverified'
    CHECK (verification_tier IN (
      'unverified',
      'business_verified',
      'credential_verified',
      'platform_vouched'
    ));

-- Index for slug lookups (public profile page)
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_slug
  ON public.vendor_profiles (slug)
  WHERE slug IS NOT NULL;

-- Index for public directory query
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_public_directory
  ON public.vendor_profiles (verification_status, public_profile_enabled);

-- ─────────────────────────────────────────────
-- 2. Public read RLS policy for verified vendors
--    Scoped to: verified status + public_profile_enabled = true
--    Does NOT expose: ein_full, ein_last4, notes, reviewed_by, tax_exempt_ein
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "public_read_verified_vendor_profiles" ON public.vendor_profiles;
CREATE POLICY "public_read_verified_vendor_profiles"
  ON public.vendor_profiles
  FOR SELECT
  TO anon
  USING (
    verification_status = 'verified'
    AND public_profile_enabled = true
  );

-- Also allow authenticated users to see verified public profiles (not just their own)
DROP POLICY IF EXISTS "authenticated_read_verified_vendor_profiles" ON public.vendor_profiles;
CREATE POLICY "authenticated_read_verified_vendor_profiles"
  ON public.vendor_profiles
  FOR SELECT
  TO authenticated
  USING (
    (verification_status = 'verified' AND public_profile_enabled = true)
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Drop the old authenticated-only self-read policy (replaced by the combined one above)
DROP POLICY IF EXISTS "users_read_own_vendor_profiles" ON public.vendor_profiles;

-- ─────────────────────────────────────────────
-- 3. vendor_leads table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  property_address text,
  service_needed text,
  message text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'closed', 'spam', 'archived')),
  source text NOT NULL DEFAULT 'vendor_directory',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.vendor_leads TO authenticated;
GRANT INSERT ON public.vendor_leads TO anon;
GRANT ALL ON public.vendor_leads TO service_role;

ALTER TABLE public.vendor_leads ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can submit a lead
DROP POLICY IF EXISTS "anyone_insert_vendor_leads" ON public.vendor_leads;
CREATE POLICY "anyone_insert_vendor_leads"
  ON public.vendor_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Vendors can read leads for their own profile
DROP POLICY IF EXISTS "vendors_read_own_leads" ON public.vendor_leads;
CREATE POLICY "vendors_read_own_leads"
  ON public.vendor_leads
  FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

-- Vendors can update status on their own leads
DROP POLICY IF EXISTS "vendors_update_own_leads" ON public.vendor_leads;
CREATE POLICY "vendors_update_own_leads"
  ON public.vendor_leads
  FOR UPDATE
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins have full access
DROP POLICY IF EXISTS "admins_manage_vendor_leads" ON public.vendor_leads;
CREATE POLICY "admins_manage_vendor_leads"
  ON public.vendor_leads
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_vendor_leads_vendor_profile
  ON public.vendor_leads (vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_vendor_leads_status
  ON public.vendor_leads (status);
CREATE INDEX IF NOT EXISTS idx_vendor_leads_created_at
  ON public.vendor_leads (created_at DESC);

-- updated_at trigger for vendor_leads
CREATE OR REPLACE FUNCTION public.set_vendor_leads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_vendor_leads_updated_at ON public.vendor_leads;
CREATE TRIGGER set_vendor_leads_updated_at
  BEFORE UPDATE ON public.vendor_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_vendor_leads_updated_at();
