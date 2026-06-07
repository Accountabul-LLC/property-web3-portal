
-- Make vendor_profile_id and message nullable for intake-only leads
ALTER TABLE public.vendor_leads ALTER COLUMN vendor_profile_id DROP NOT NULL;
ALTER TABLE public.vendor_leads ALTER COLUMN message DROP NOT NULL;

-- New columns for intake form
ALTER TABLE public.vendor_leads
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS city_service_area text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS licensed_status text,
  ADD COLUMN IF NOT EXISTS best_time_to_contact text,
  ADD COLUMN IF NOT EXISTS serves_real_estate text,
  ADD COLUMN IF NOT EXISTS service_description text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Length caps on new text columns
ALTER TABLE public.vendor_leads
  ADD CONSTRAINT vendor_leads_business_name_len CHECK (business_name IS NULL OR char_length(business_name) <= 200),
  ADD CONSTRAINT vendor_leads_city_len CHECK (city_service_area IS NULL OR char_length(city_service_area) <= 200),
  ADD CONSTRAINT vendor_leads_occupation_len CHECK (occupation IS NULL OR char_length(occupation) <= 200),
  ADD CONSTRAINT vendor_leads_licensed_len CHECK (licensed_status IS NULL OR char_length(licensed_status) <= 40),
  ADD CONSTRAINT vendor_leads_best_time_len CHECK (best_time_to_contact IS NULL OR char_length(best_time_to_contact) <= 40),
  ADD CONSTRAINT vendor_leads_serves_re_len CHECK (serves_real_estate IS NULL OR char_length(serves_real_estate) <= 40),
  ADD CONSTRAINT vendor_leads_service_desc_len CHECK (service_description IS NULL OR char_length(service_description) <= 2000),
  ADD CONSTRAINT vendor_leads_internal_notes_len CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 5000);

-- Expand status check constraint
ALTER TABLE public.vendor_leads DROP CONSTRAINT IF EXISTS vendor_leads_status_check;
ALTER TABLE public.vendor_leads ADD CONSTRAINT vendor_leads_status_check
  CHECK (status IN ('new','contacted','interested','not_interested','approved','rejected','closed','spam','archived'));

-- Allow public/auth users to submit intake-join leads (no vendor_profile_id)
DROP POLICY IF EXISTS "Anyone can submit intake join lead" ON public.vendor_leads;
CREATE POLICY "Anyone can submit intake join lead"
  ON public.vendor_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    source = 'intake_join'
    AND vendor_profile_id IS NULL
    AND requester_name IS NOT NULL
    AND requester_email IS NOT NULL
  );

-- Index to speed up admin filtering by source/status
CREATE INDEX IF NOT EXISTS vendor_leads_source_idx ON public.vendor_leads(source);
CREATE INDEX IF NOT EXISTS vendor_leads_follow_up_idx ON public.vendor_leads(follow_up_date);
