
-- Extend vendor_profiles
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS profile_headline TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS business_address_city TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS business_address_state TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS business_address_zip TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS years_in_business INTEGER;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS verification_tier TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_verification_tier_check') THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_verification_tier_check
      CHECK (verification_tier IS NULL OR verification_tier IN ('basic','identity','licensed','insured','platform_vouched'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_profiles_slug_lower_unique ON public.vendor_profiles (lower(slug)) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendor_profiles_public_idx ON public.vendor_profiles (verification_status, public_profile_enabled) WHERE public_profile_enabled = true;

-- Public read access for verified, opted-in vendors
DROP POLICY IF EXISTS "Public can read verified public vendors" ON public.vendor_profiles;
CREATE POLICY "Public can read verified public vendors"
  ON public.vendor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (verification_status = 'verified' AND public_profile_enabled = true);

GRANT SELECT ON public.vendor_profiles TO anon;

-- vendor_leads table
CREATE TABLE IF NOT EXISTS public.vendor_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  message TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','won','lost','spam')),
  vendor_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.vendor_leads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.vendor_leads TO authenticated;
GRANT ALL ON public.vendor_leads TO service_role;

CREATE INDEX IF NOT EXISTS vendor_leads_vendor_idx ON public.vendor_leads (vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_leads_status_idx ON public.vendor_leads (status);
CREATE INDEX IF NOT EXISTS vendor_leads_created_idx ON public.vendor_leads (created_at DESC);

ALTER TABLE public.vendor_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit lead to public vendor" ON public.vendor_leads;
CREATE POLICY "Anyone can submit lead to public vendor"
  ON public.vendor_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.id = vendor_profile_id
        AND vp.verification_status = 'verified'
        AND vp.public_profile_enabled = true
    )
  );

DROP POLICY IF EXISTS "Vendor can read own leads" ON public.vendor_leads;
CREATE POLICY "Vendor can read own leads"
  ON public.vendor_leads
  FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendor can update own leads" ON public.vendor_leads;
CREATE POLICY "Vendor can update own leads"
  ON public.vendor_leads
  FOR UPDATE
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage all leads" ON public.vendor_leads;
CREATE POLICY "Admins manage all leads"
  ON public.vendor_leads
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_vendor_leads_updated_at ON public.vendor_leads;
CREATE TRIGGER trg_vendor_leads_updated_at
  BEFORE UPDATE ON public.vendor_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
