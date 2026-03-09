-- credential_catalog: user-facing credential product catalog
CREATE TABLE IF NOT EXISTS public.credential_catalog (
  credential_key         TEXT PRIMARY KEY,
  credential_name        TEXT NOT NULL,
  description            TEXT NOT NULL,
  allowed_account_types  TEXT[] NOT NULL DEFAULT '{}',
  requires_kyc           BOOLEAN NOT NULL DEFAULT true,
  requires_wallet        BOOLEAN NOT NULL DEFAULT true,
  maps_to_xrpl_code      TEXT REFERENCES public.credential_type_registry(code),
  is_active              BOOLEAN NOT NULL DEFAULT true,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 7 credential types
INSERT INTO public.credential_catalog (credential_key, credential_name, description, allowed_account_types, maps_to_xrpl_code, sort_order) VALUES
  ('verified_user',     'Verified User',       'Identity verified on-chain. Required for all platform interactions.', ARRAY['individual','business'], 'RETAIL_TRADING_BASIC', 10),
  ('property_lister',   'Property Lister',     'List tokenized real estate on the Accountabul marketplace.',          ARRAY['individual','business'], 'RETAIL_TRADING_BASIC', 20),
  ('token_trader',      'Token Trader',        'Buy and sell property tokens on the DEX.',                            ARRAY['individual','business'], 'RETAIL_TRADING_BASIC', 30),
  ('vendor',            'Vendor',              'Sell services on the Accountabul vendor marketplace.',                ARRAY['business'],              'VENDOR_MARKETPLACE_APPROVED', 40),
  ('appraiser',         'Appraiser',           'Provide certified property appraisals on the platform.',              ARRAY['business'],              NULL, 50),
  ('notary',            'Notary',              'Provide notarization services for property transactions.',             ARRAY['business'],              NULL, 60),
  ('service_provider',  'Service Provider',    'Offer professional real estate services to platform users.',          ARRAY['business'],              NULL, 70)
ON CONFLICT (credential_key) DO NOTHING;

-- credential_applications: full application lifecycle
CREATE TABLE IF NOT EXISTS public.credential_applications (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address       TEXT        NOT NULL,
  credential_key       TEXT        NOT NULL REFERENCES public.credential_catalog(credential_key),
  status               TEXT        NOT NULL DEFAULT 'applied'
    CHECK (status IN ('draft','applied','under_review','approved','rejected','issued_pending_acceptance','active','expired','revoked')),
  applied_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at          TIMESTAMPTZ,
  reviewed_by          UUID        REFERENCES auth.users(id),
  rejection_reason     TEXT,
  issued_at            TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ,
  accepted_at          TIMESTAMPTZ,
  revoked_at           TIMESTAMPTZ,
  revocation_reason    TEXT,
  notes                TEXT,
  wallet_credential_id UUID        REFERENCES public.wallet_credentials(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, credential_key, wallet_address)
);

-- gate_decisions: Phase 4 audit log for all gate checks
CREATE TABLE IF NOT EXISTS public.gate_decisions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES auth.users(id),
  wallet_address  TEXT,
  feature_key     TEXT,
  credential_key  TEXT,
  is_eligible     BOOLEAN     NOT NULL,
  blocking_reason TEXT,
  next_action     TEXT,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- route_access_rules: page-level access control
CREATE TABLE IF NOT EXISTS public.route_access_rules (
  route_key             TEXT    PRIMARY KEY,
  route_label           TEXT    NOT NULL,
  requires_login        BOOLEAN NOT NULL DEFAULT true,
  requires_wallet       BOOLEAN NOT NULL DEFAULT false,
  required_credential   TEXT    REFERENCES public.credential_catalog(credential_key),
  allowed_account_types TEXT[]
);

INSERT INTO public.route_access_rules (route_key, route_label, requires_login, requires_wallet, required_credential, allowed_account_types) VALUES
  ('vendor_directory',  'Vendor Directory',     false, false, NULL,              NULL),
  ('vendor_dashboard',  'Vendor Dashboard',     true,  true,  'vendor',          ARRAY['business']),
  ('list_property',     'List Property',        true,  true,  'property_lister', NULL),
  ('trade_tokens',      'Trade Tokens',         true,  true,  'token_trader',    NULL),
  ('apply_credential',  'Apply for Credential', true,  true,  NULL,              NULL),
  ('credentials_page',  'Credentials Page',     true,  false, NULL,              NULL),
  ('admin_dashboard',   'Admin Dashboard',      true,  false, NULL,              NULL)
ON CONFLICT (route_key) DO NOTHING;

-- RLS for credential_catalog
ALTER TABLE public.credential_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_catalog" ON public.credential_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins_manage_catalog" ON public.credential_catalog FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS for credential_applications
ALTER TABLE public.credential_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_applications" ON public.credential_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users_insert_own_applications" ON public.credential_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins_all_applications" ON public.credential_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance_officer'));

-- RLS for gate_decisions
ALTER TABLE public.gate_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_gate_decisions" ON public.gate_decisions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance_officer'));
CREATE POLICY "service_insert_gate_decisions" ON public.gate_decisions FOR INSERT TO service_role WITH CHECK (true);

-- RLS for route_access_rules
ALTER TABLE public.route_access_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_routes" ON public.route_access_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins_manage_routes" ON public.route_access_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- handle_expired_applications: marks issued_pending_acceptance → expired when expires_at < now()
CREATE OR REPLACE FUNCTION public.expire_stale_credential_applications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated INTEGER;
BEGIN
  UPDATE public.credential_applications
  SET status = 'expired', updated_at = now()
  WHERE status = 'issued_pending_acceptance'
    AND expires_at < now();
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;
