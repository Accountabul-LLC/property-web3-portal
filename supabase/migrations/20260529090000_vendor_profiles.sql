-- Vendor CRM profile data used by the verified vendor approval pipeline.

CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  logo_url text,
  business_email text,
  business_phone text,
  website_url text,
  industry_category text,
  business_description text,
  service_areas text,
  place_of_business text,
  employee_count integer,
  ein_last4 text,
  tax_exempt_number text,
  applicant_title text,
  advertising_opt_in boolean NOT NULL DEFAULT false,
  public_profile_visible boolean NOT NULL DEFAULT false,
  subscription_status text NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'pending', 'active', 'past_due', 'canceled')),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'waived')),
  ad_request_status text NOT NULL DEFAULT 'no_request'
    CHECK (ad_request_status IN ('no_request', 'requested', 'pending_approval', 'approved', 'denied', 'active', 'completed')),
  vendor_tier text NOT NULL DEFAULT 'standard',
  verification_status text NOT NULL DEFAULT 'not_requested'
    CHECK (verification_status IN ('not_requested', 'requested', 'under_review', 'more_info_needed', 'approved', 'denied', 'suspended')),
  verified_at timestamptz,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  suspended_at timestamptz,
  suspended_by uuid REFERENCES auth.users(id),
  suspension_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_verification_status ON public.vendor_profiles (verification_status);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_company_name ON public.vendor_profiles (company_name);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_user_id ON public.vendor_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_ad_request_status ON public.vendor_profiles (ad_request_status);

ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_vendor_profiles" ON public.vendor_profiles;
CREATE POLICY "users_read_own_vendor_profiles"
  ON public.vendor_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_vendor_profiles" ON public.vendor_profiles;
CREATE POLICY "users_insert_own_vendor_profiles"
  ON public.vendor_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_vendor_profiles" ON public.vendor_profiles;
CREATE POLICY "users_update_own_vendor_profiles"
  ON public.vendor_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_manage_vendor_profiles" ON public.vendor_profiles;
CREATE POLICY "admins_manage_vendor_profiles"
  ON public.vendor_profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance_officer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance_officer'));

DROP TRIGGER IF EXISTS update_vendor_profiles_updated_at ON public.vendor_profiles;
CREATE TRIGGER update_vendor_profiles_updated_at
  BEFORE UPDATE ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

