DROP FUNCTION IF EXISTS public.get_vendor_public_profile_by_slug(text);
DROP VIEW IF EXISTS public.vendor_public_profiles;

CREATE VIEW public.vendor_public_profiles
WITH (security_invoker = on) AS
SELECT
  vp.id, vp.slug, vp.company_name, vp.logo_url,
  vp.business_email, vp.business_phone, vp.website_url,
  vp.industry AS industry_category,
  vp.vendor_bio AS business_description,
  vp.service_areas, vp.place_of_business,
  vp.business_address_city, vp.business_address_state, vp.business_address_zip,
  vp.years_in_business, vp.verification_tier, vp.profile_headline,
  vp.public_profile_enabled, vp.verification_status, vp.created_at
FROM public.vendor_profiles vp
WHERE vp.public_profile_enabled = true
  AND vp.slug IS NOT NULL;

GRANT SELECT ON public.vendor_public_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_vendor_public_profile_by_slug(p_slug text)
RETURNS SETOF public.vendor_public_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    vp.id, vp.slug, vp.company_name, vp.logo_url,
    vp.business_email, vp.business_phone, vp.website_url,
    vp.industry AS industry_category,
    vp.vendor_bio AS business_description,
    vp.service_areas, vp.place_of_business,
    vp.business_address_city, vp.business_address_state, vp.business_address_zip,
    vp.years_in_business, vp.verification_tier, vp.profile_headline,
    vp.public_profile_enabled, vp.verification_status, vp.created_at
  FROM public.vendor_profiles vp
  WHERE lower(vp.slug) = lower(p_slug)
    AND (
      (vp.public_profile_enabled = true AND vp.slug IS NOT NULL)
      OR vp.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_public_profile_by_slug(text) TO anon, authenticated;