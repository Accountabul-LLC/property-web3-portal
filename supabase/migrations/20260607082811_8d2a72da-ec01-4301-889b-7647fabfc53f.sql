-- Revert duplicate vendor intake schema additions
-- 1) Remove intake-only rows so we can restore NOT NULL on vendor_profile_id / message
DELETE FROM public.vendor_leads WHERE source = 'intake_join';

-- 2) Drop the intake INSERT policy
DROP POLICY IF EXISTS "Anyone can submit intake join lead" ON public.vendor_leads;

-- 3) Drop added length constraints
ALTER TABLE public.vendor_leads
  DROP CONSTRAINT IF EXISTS vendor_leads_business_name_len,
  DROP CONSTRAINT IF EXISTS vendor_leads_city_len,
  DROP CONSTRAINT IF EXISTS vendor_leads_occupation_len,
  DROP CONSTRAINT IF EXISTS vendor_leads_licensed_len,
  DROP CONSTRAINT IF EXISTS vendor_leads_best_time_len,
  DROP CONSTRAINT IF EXISTS vendor_leads_serves_re_len,
  DROP CONSTRAINT IF EXISTS vendor_leads_service_desc_len,
  DROP CONSTRAINT IF EXISTS vendor_leads_internal_notes_len;

-- 4) Drop added columns
ALTER TABLE public.vendor_leads
  DROP COLUMN IF EXISTS business_name,
  DROP COLUMN IF EXISTS city_service_area,
  DROP COLUMN IF EXISTS occupation,
  DROP COLUMN IF EXISTS licensed_status,
  DROP COLUMN IF EXISTS best_time_to_contact,
  DROP COLUMN IF EXISTS serves_real_estate,
  DROP COLUMN IF EXISTS service_description,
  DROP COLUMN IF EXISTS internal_notes,
  DROP COLUMN IF EXISTS follow_up_date,
  DROP COLUMN IF EXISTS assigned_admin_id;

-- 5) Restore original status check (without intake-specific values)
ALTER TABLE public.vendor_leads DROP CONSTRAINT IF EXISTS vendor_leads_status_check;
ALTER TABLE public.vendor_leads ADD CONSTRAINT vendor_leads_status_check
  CHECK (status IN ('new','contacted','closed','spam'));

-- 6) Restore NOT NULL on vendor_profile_id and message
ALTER TABLE public.vendor_leads ALTER COLUMN vendor_profile_id SET NOT NULL;
ALTER TABLE public.vendor_leads ALTER COLUMN message SET NOT NULL;

-- 7) Drop indexes added for intake admin filtering
DROP INDEX IF EXISTS public.vendor_leads_source_idx;
DROP INDEX IF EXISTS public.vendor_leads_follow_up_idx;
