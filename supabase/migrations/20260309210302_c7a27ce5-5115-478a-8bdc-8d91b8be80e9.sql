
-- 1. credential_catalog table
CREATE TABLE public.credential_catalog (
  credential_key text PRIMARY KEY,
  credential_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  allowed_account_types text[] NOT NULL DEFAULT '{individual}',
  requires_kyc boolean NOT NULL DEFAULT true,
  requires_wallet boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  maps_to_xrpl_code text
);

ALTER TABLE public.credential_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active catalog entries"
  ON public.credential_catalog FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage catalog"
  ON public.credential_catalog FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. credential_applications table
CREATE TABLE public.credential_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  credential_key text NOT NULL REFERENCES public.credential_catalog(credential_key),
  status text NOT NULL DEFAULT 'pending',
  applied_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  rejection_reason text,
  issued_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  notes text,
  wallet_credential_id uuid REFERENCES public.wallet_credentials(id)
);

ALTER TABLE public.credential_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own applications"
  ON public.credential_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own applications"
  ON public.credential_applications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all applications"
  ON public.credential_applications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all applications"
  ON public.credential_applications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can update applications"
  ON public.credential_applications FOR UPDATE
  TO public
  USING (true);
