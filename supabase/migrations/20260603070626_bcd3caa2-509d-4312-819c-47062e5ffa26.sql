
-- ============================================================
-- Vendor security hardening
-- ============================================================

-- 1. Rebuild vendor_public_profiles as a security_invoker view
--    that ONLY exposes verified, published vendors.
DROP VIEW IF EXISTS public.vendor_public_profiles;

CREATE VIEW public.vendor_public_profiles
WITH (security_invoker = on) AS
SELECT
  vp.id,
  vp.slug,
  vp.company_name,
  vp.logo_url,
  vp.business_email,
  vp.business_phone,
  vp.website_url,
  vp.industry            AS industry_category,
  vp.vendor_bio          AS business_description,
  vp.service_areas,
  vp.business_address_city,
  vp.business_address_state,
  vp.business_address_zip,
  vp.years_in_business,
  vp.verification_tier,
  vp.profile_headline,
  vp.public_profile_enabled,
  vp.verification_status,
  vp.created_at
FROM public.vendor_profiles vp
WHERE vp.public_profile_enabled = true
  AND vp.slug IS NOT NULL
  AND vp.verification_status = 'verified';

GRANT SELECT ON public.vendor_public_profiles TO anon, authenticated;

-- 2. Add a SECURITY DEFINER helper that lets the owner read their
--    OWN profile through the same view shape — so the "preview my
--    public profile" UX still works even when not yet verified.
CREATE OR REPLACE FUNCTION public.get_vendor_public_profile_by_slug(p_slug text)
RETURNS SETOF public.vendor_public_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vp.id, vp.slug, vp.company_name, vp.logo_url,
    vp.business_email, vp.business_phone, vp.website_url,
    vp.industry AS industry_category,
    vp.vendor_bio AS business_description,
    vp.service_areas,
    vp.business_address_city, vp.business_address_state, vp.business_address_zip,
    vp.years_in_business, vp.verification_tier, vp.profile_headline,
    vp.public_profile_enabled, vp.verification_status, vp.created_at
  FROM public.vendor_profiles vp
  WHERE lower(vp.slug) = lower(p_slug)
    AND (
      -- public consumers: only verified & published
      (vp.public_profile_enabled = true AND vp.verification_status = 'verified')
      -- owner: always allowed to preview own profile
      OR vp.user_id = auth.uid()
      -- admins
      OR public.has_role(auth.uid(), 'admin')
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_public_profile_by_slug(text) TO anon, authenticated;

-- 3. Lock down vendor verification columns: only admins (or service_role
--    via SECURITY DEFINER triggers) may change verification_status,
--    verification_tier, verified_at, reviewed_by, reviewed_at.
CREATE OR REPLACE FUNCTION public.vendor_profiles_lock_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.verification_status := OLD.verification_status;
    NEW.verification_tier   := OLD.verification_tier;
    NEW.verified_at         := OLD.verified_at;
    NEW.reviewed_by         := OLD.reviewed_by;
    NEW.reviewed_at         := OLD.reviewed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_profiles_lock_verification ON public.vendor_profiles;
CREATE TRIGGER trg_vendor_profiles_lock_verification
BEFORE UPDATE ON public.vendor_profiles
FOR EACH ROW EXECUTE FUNCTION public.vendor_profiles_lock_verification();

-- Also guard initial INSERT — non-admins cannot self-set 'verified'
CREATE OR REPLACE FUNCTION public.vendor_profiles_default_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.verification_status IS NULL
       OR NEW.verification_status NOT IN ('not_started','draft','requested','pending','under_review') THEN
      NEW.verification_status := 'not_started';
    END IF;
    NEW.verification_tier := NULL;
    NEW.verified_at       := NULL;
    NEW.reviewed_by       := NULL;
    NEW.reviewed_at       := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_profiles_default_verification ON public.vendor_profiles;
CREATE TRIGGER trg_vendor_profiles_default_verification
BEFORE INSERT ON public.vendor_profiles
FOR EACH ROW EXECUTE FUNCTION public.vendor_profiles_default_verification();

-- 4. Tighten public product read to require verified vendor
DROP POLICY IF EXISTS "Public can read published products" ON public.vendor_products;
CREATE POLICY "Public can read published products"
  ON public.vendor_products
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.id = vendor_products.vendor_profile_id
        AND vp.verification_status = 'verified'
        AND vp.public_profile_enabled = true
    )
  );

-- 5. Hard length caps on vendor_leads (prevent 20KB spam payloads)
ALTER TABLE public.vendor_leads
  ADD CONSTRAINT vendor_leads_name_len    CHECK (char_length(requester_name)  BETWEEN 1 AND 200),
  ADD CONSTRAINT vendor_leads_email_len   CHECK (char_length(requester_email) BETWEEN 3 AND 320),
  ADD CONSTRAINT vendor_leads_email_fmt   CHECK (requester_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT vendor_leads_phone_len   CHECK (requester_phone IS NULL OR char_length(requester_phone) <= 40),
  ADD CONSTRAINT vendor_leads_message_len CHECK (char_length(message) BETWEEN 1 AND 4000),
  ADD CONSTRAINT vendor_leads_service_len CHECK (service_needed IS NULL OR char_length(service_needed) <= 200),
  ADD CONSTRAINT vendor_leads_address_len CHECK (property_address IS NULL OR char_length(property_address) <= 500),
  ADD CONSTRAINT vendor_leads_source_len  CHECK (char_length(source) <= 60);

-- 6. Defense in depth: revoke broad anon write grants on vendor tables.
--    RLS already blocks these, but principle of least privilege.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vendor_profiles    FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vendor_products    FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vendor_credentials FROM anon;
-- vendor_leads keeps anon INSERT (policy already constrains it to verified vendors)
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vendor_leads FROM anon;
