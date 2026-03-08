
-- 1. Permission profiles lookup table
CREATE TABLE public.permission_profiles (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read permission profiles"
  ON public.permission_profiles FOR SELECT
  USING (true);

INSERT INTO public.permission_profiles (code, label, description) VALUES
  ('TRADE_GLOBAL', 'Global Trading', 'Allows buying and selling of tokenized assets on the marketplace.');

-- 2. XRPL issuer wallets (admin-managed)
CREATE TABLE public.xrpl_issuer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_address TEXT NOT NULL,
  secret_env_key TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'testnet',
  status TEXT NOT NULL DEFAULT 'active',
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.xrpl_issuer_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage issuer wallets"
  ON public.xrpl_issuer_wallets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Wallet registrations
CREATE TABLE public.wallet_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kyc_case_id UUID REFERENCES public.kyc_cases(id),
  kyc_snapshot JSONB,
  registration_status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id UUID,
  reviewed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_id)
);

ALTER TABLE public.wallet_registrations ENABLE ROW LEVEL SECURITY;

-- Users can read own registrations
CREATE POLICY "Users can read own wallet registrations"
  ON public.wallet_registrations FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all
CREATE POLICY "Admins can read all wallet registrations"
  ON public.wallet_registrations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update
CREATE POLICY "Admins can update wallet registrations"
  ON public.wallet_registrations FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Service insert (edge function with service role)
CREATE POLICY "Service can insert wallet registrations"
  ON public.wallet_registrations FOR INSERT
  WITH CHECK (true);

-- Service update for re-registration
CREATE POLICY "Service can update wallet registrations"
  ON public.wallet_registrations FOR UPDATE
  USING (true);

-- 4. Wallet credentials
CREATE TABLE public.wallet_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  wallet_registration_id UUID REFERENCES public.wallet_registrations(id),
  issuer_wallet_id UUID REFERENCES public.xrpl_issuer_wallets(id),
  issuer_address TEXT NOT NULL,
  credential_type TEXT NOT NULL DEFAULT 'ACCOUNTABUL_TRADE_APPROVED',
  credential_type_hex TEXT,
  ledger_status TEXT NOT NULL DEFAULT 'pending_issuance',
  tx_hash TEXT,
  issued_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credentials"
  ON public.wallet_credentials FOR SELECT
  USING (wallet_id IN (SELECT id FROM public.user_wallets WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage credentials"
  ON public.wallet_credentials FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert credentials"
  ON public.wallet_credentials FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update credentials"
  ON public.wallet_credentials FOR UPDATE
  USING (true);

-- 5. Wallet permission assignments
CREATE TABLE public.wallet_permission_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  permission_profile_code TEXT NOT NULL REFERENCES public.permission_profiles(code),
  status TEXT NOT NULL DEFAULT 'active',
  granted_by UUID,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, permission_profile_code)
);

ALTER TABLE public.wallet_permission_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own permission assignments"
  ON public.wallet_permission_assignments FOR SELECT
  USING (wallet_id IN (SELECT id FROM public.user_wallets WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage permission assignments"
  ON public.wallet_permission_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can upsert permission assignments"
  ON public.wallet_permission_assignments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update permission assignments"
  ON public.wallet_permission_assignments FOR UPDATE
  USING (true);

-- 6. is_wallet_trade_enabled function
CREATE OR REPLACE FUNCTION public.is_wallet_trade_enabled(p_wallet_address TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_wallets uw
    JOIN public.wallet_registrations wr ON wr.wallet_id = uw.id
    JOIN public.wallet_credentials wc ON wc.wallet_id = uw.id
    WHERE uw.wallet_address = p_wallet_address
      AND uw.status = 'active'
      AND wr.registration_status = 'approved'
      AND wc.ledger_status = 'accepted'
  )
$$;
