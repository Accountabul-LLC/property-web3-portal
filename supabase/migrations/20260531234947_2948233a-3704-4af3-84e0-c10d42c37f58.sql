-- 1. Verification table
CREATE TABLE public.profile_field_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  field_name text NOT NULL,
  source text NOT NULL CHECK (source IN ('stripe_identity','kyc_review','oauth_google','vendor_intake')),
  verified_value text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, field_name)
);

-- 2. Grants
GRANT SELECT ON public.profile_field_verifications TO authenticated;
GRANT ALL ON public.profile_field_verifications TO service_role;

-- 3. RLS
ALTER TABLE public.profile_field_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own verifications"
  ON public.profile_field_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all verifications"
  ON public.profile_field_verifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- (No INSERT/UPDATE/DELETE policies for authenticated — writes are service_role only.)

CREATE INDEX profile_field_verifications_user_id_idx
  ON public.profile_field_verifications (user_id);

-- 4. Helper RPC
CREATE OR REPLACE FUNCTION public.get_profile_verifications()
RETURNS TABLE (
  field_name text,
  source text,
  verified_value text,
  verified_at timestamptz,
  metadata jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.field_name, v.source, v.verified_value, v.verified_at, v.metadata
  FROM public.profile_field_verifications v
  WHERE v.user_id = auth.uid()
  ORDER BY v.field_name;
$$;

REVOKE ALL ON FUNCTION public.get_profile_verifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_verifications() TO authenticated, service_role;
