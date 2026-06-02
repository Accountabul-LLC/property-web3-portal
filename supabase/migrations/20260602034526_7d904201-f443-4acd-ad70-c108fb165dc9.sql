ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS applicant_title text,
  ADD COLUMN IF NOT EXISTS service_areas text,
  ADD COLUMN IF NOT EXISTS tax_exempt_number text;