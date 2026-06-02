
CREATE OR REPLACE VIEW public.vendor_public_profiles
WITH (security_invoker = off) AS
SELECT
  vp.id,
  vp.slug,
  vp.company_name,
  vp.logo_url,
  vp.business_email,
  vp.business_phone,
  vp.website_url,
  vp.industry          AS industry_category,
  vp.vendor_bio        AS business_description,
  vp.service_areas,
  vp.business_address_city,
  vp.business_address_state,
  vp.business_address_zip,
  vp.years_in_business,
  vp.verification_tier,
  vp.profile_headline,
  vp.public_profile_enabled,
  vp.verification_status
FROM public.vendor_profiles vp
WHERE vp.public_profile_enabled = true
  AND vp.slug IS NOT NULL
  AND vp.verification_status NOT IN ('denied', 'suspended');

GRANT SELECT ON public.vendor_public_profiles TO anon, authenticated;
