CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
  reviewed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_profiles TO authenticated;
GRANT ALL ON public.vendor_profiles TO service_role;

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
  WITH CHECK (user_id = auth.uid() AND profile_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_vendor_profiles" ON public.vendor_profiles;
CREATE POLICY "users_update_own_vendor_profiles"
  ON public.vendor_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND profile_id = auth.uid());

DROP POLICY IF EXISTS "admins_manage_vendor_profiles" ON public.vendor_profiles;
CREATE POLICY "admins_manage_vendor_profiles"
  ON public.vendor_profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_verification_status ON public.vendor_profiles (verification_status);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_company_name ON public.vendor_profiles (company_name);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_user_id ON public.vendor_profiles (user_id);

CREATE OR REPLACE FUNCTION public.set_vendor_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_vendor_profiles_updated_at ON public.vendor_profiles;
CREATE TRIGGER set_vendor_profiles_updated_at
BEFORE UPDATE ON public.vendor_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_vendor_profiles_updated_at();