
-- 1. Add new columns to vendor_profiles
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS ein_full text,
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exempt_ein text;

-- 2. Create vendor_credentials table
CREATE TABLE IF NOT EXISTS public.vendor_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  credential_type text NOT NULL,
  credential_number text NOT NULL,
  issuing_state text,
  issuing_authority text,
  expires_on date,
  document_path text,
  document_name text,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','submitted','verified','rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_credentials TO authenticated;
GRANT ALL ON public.vendor_credentials TO service_role;

ALTER TABLE public.vendor_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_vendor_credentials" ON public.vendor_credentials;
CREATE POLICY "users_read_own_vendor_credentials"
  ON public.vendor_credentials FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_vendor_credentials" ON public.vendor_credentials;
CREATE POLICY "users_insert_own_vendor_credentials"
  ON public.vendor_credentials FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_vendor_credentials" ON public.vendor_credentials;
CREATE POLICY "users_update_own_vendor_credentials"
  ON public.vendor_credentials FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_vendor_credentials" ON public.vendor_credentials;
CREATE POLICY "users_delete_own_vendor_credentials"
  ON public.vendor_credentials FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_manage_vendor_credentials" ON public.vendor_credentials;
CREATE POLICY "admins_manage_vendor_credentials"
  ON public.vendor_credentials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_vendor_credentials_vendor_profile ON public.vendor_credentials (vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_vendor_credentials_user ON public.vendor_credentials (user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_credentials_type ON public.vendor_credentials (credential_type);

DROP TRIGGER IF EXISTS set_vendor_credentials_updated_at ON public.vendor_credentials;
CREATE TRIGGER set_vendor_credentials_updated_at
BEFORE UPDATE ON public.vendor_credentials
FOR EACH ROW
EXECUTE FUNCTION public.set_vendor_profiles_updated_at();

-- 3. Create private storage bucket for credential documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-credentials', 'vendor-credentials', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: owner-only access scoped by first folder = user_id
DROP POLICY IF EXISTS "vendor_credentials_owner_read" ON storage.objects;
CREATE POLICY "vendor_credentials_owner_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vendor-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "vendor_credentials_owner_insert" ON storage.objects;
CREATE POLICY "vendor_credentials_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "vendor_credentials_owner_update" ON storage.objects;
CREATE POLICY "vendor_credentials_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vendor-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "vendor_credentials_owner_delete" ON storage.objects;
CREATE POLICY "vendor_credentials_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "vendor_credentials_admin_read" ON storage.objects;
CREATE POLICY "vendor_credentials_admin_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vendor-credentials'
    AND public.has_role(auth.uid(), 'admin')
  );
