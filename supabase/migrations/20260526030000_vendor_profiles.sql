-- Vendor CRM profile data for business accounts that request verified vendor status.

CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  logo_url text,
  business_email text,
  business_phone text,
  place_of_business text,
  employee_count integer,
  ein_last4 text,
  advertising_opt_in boolean NOT NULL DEFAULT false,
  vendor_bio text,
  verification_status text NOT NULL DEFAULT 'not_requested'
    CHECK (verification_status IN ('not_requested', 'requested', 'under_review', 'verified', 'rejected', 'revoked')),
  verified_at timestamptz,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (profile_id)
);

ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_vendor_profiles"
  ON public.vendor_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_upsert_own_vendor_profiles"
  ON public.vendor_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_vendor_profiles"
  ON public.vendor_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins_manage_vendor_profiles"
  ON public.vendor_profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance_officer'));

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_verification_status ON public.vendor_profiles (verification_status);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_company_name ON public.vendor_profiles (company_name);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_user_id ON public.vendor_profiles (user_id);
