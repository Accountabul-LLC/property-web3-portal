-- ============================================================
-- Phase 1A: Compliance Wallet Layer
-- Adds the tables and DB function that power Accountabul's
-- off-ledger policy engine for permissioned trading.
--
-- Tables:
--   wallet_registrations         — one per wallet, tracks trade registration lifecycle
--   wallet_credentials           — tracks XRPL credential issuance/acceptance per wallet
--   permission_profiles          — named permission tiers (TRADE_GLOBAL, PREMIUM, etc.)
--   wallet_permission_assignments — assigns tiers to approved wallets
--
-- Function:
--   is_wallet_trade_enabled(address) — true only when full compliance stack satisfied
--
-- Design note:
--   Enforcement in Phase 1A is app-layer (this DB function + edge function guards).
--   In Phase 1B, native pDEX + Permissioned Domains replace the app-layer gate,
--   but this schema already tracks on-ledger credential state for that transition.
-- ============================================================

-- ── 1. New columns on user_wallets ──────────────────────────
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS signature_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- ── 2. wallet_registrations ─────────────────────────────────
-- One row per wallet. Status lifecycle:
--   pending → under_review → approved → (revoked)
--                          → rejected
CREATE TABLE IF NOT EXISTS public.wallet_registrations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id            UUID        NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_status  TEXT        NOT NULL DEFAULT 'pending'
    CHECK (registration_status IN ('pending','under_review','approved','rejected','revoked')),
  kyc_case_id          UUID        REFERENCES public.kyc_cases(id),
  kyc_snapshot         JSONB,      -- point-in-time compliance snapshot at approval
  reviewer_id          UUID        REFERENCES auth.users(id),
  reviewed_at          TIMESTAMPTZ,
  revoked_at           TIMESTAMPTZ,
  revocation_reason    TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wallet_id)
);

-- ── 3. wallet_credentials ───────────────────────────────────
-- Tracks XRPL credential issuance and acceptance for a wallet.
-- ledger_status lifecycle:
--   pending_issuance → issued (CredentialCreate on-ledger) → accepted (CredentialAccept by subject)
--   failed | expired | deleted are terminal states
CREATE TABLE IF NOT EXISTS public.wallet_credentials (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id               UUID        NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  wallet_registration_id  UUID        REFERENCES public.wallet_registrations(id),
  issuer_address          TEXT        NOT NULL,
  credential_type         TEXT        NOT NULL,   -- human-readable, e.g. ACCOUNTABUL_TRADE_APPROVED
  credential_type_hex     TEXT        NOT NULL,   -- hex-encoded for XRPL CredentialType field
  xrpl_credential_id      TEXT,                   -- computed on-ledger after CredentialCreate
  ledger_status           TEXT        NOT NULL DEFAULT 'pending_issuance'
    CHECK (ledger_status IN ('pending_issuance','issued','accepted','expired','deleted','failed')),
  issued_at               TIMESTAMPTZ,
  accepted_at             TIMESTAMPTZ,
  expires_at              TIMESTAMPTZ,
  tx_hash_issued          TEXT,
  tx_hash_accepted        TEXT,
  error_detail            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. permission_profiles ──────────────────────────────────
-- Named permission tiers. credential_types lists which XRPL credential
-- types a wallet must hold to qualify for this profile.
CREATE TABLE IF NOT EXISTS public.permission_profiles (
  code             TEXT    PRIMARY KEY,
  description      TEXT    NOT NULL,
  credential_types TEXT[]  NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.permission_profiles (code, description, credential_types) VALUES
  (
    'TRADE_GLOBAL',
    'Base trading permission — KYC approved + registered wallet + accepted credential',
    ARRAY['ACCOUNTABUL_TRADE_APPROVED']
  ),
  (
    'PREMIUM_DEAL_ACCESS',
    'Premium early access to new property deals and extended analytics',
    ARRAY['ACCOUNTABUL_TRADE_APPROVED', 'ACCOUNTABUL_PREMIUM_ACCESS']
  ),
  (
    'ACCREDITED_INVESTOR',
    'Accredited investor access for restricted-offering property tokens',
    ARRAY['ACCOUNTABUL_TRADE_APPROVED', 'ACCOUNTABUL_ACCREDITED']
  )
ON CONFLICT (code) DO NOTHING;

-- ── 5. wallet_permission_assignments ────────────────────────
-- Links a wallet to a permission profile with lifecycle dates.
CREATE TABLE IF NOT EXISTS public.wallet_permission_assignments (
  id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id               UUID    NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  permission_profile_code TEXT    NOT NULL REFERENCES public.permission_profiles(code),
  status                  TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','revoked','expired')),
  granted_by              UUID    REFERENCES auth.users(id),
  starts_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wallet_id, permission_profile_code)
);

-- ── 6. is_wallet_trade_enabled() ────────────────────────────
-- Returns true when ALL of the following hold:
--   • wallet is active
--   • wallet owner has approved KYC (not expired)
--   • wallet has an approved registration
--   • wallet has an accepted, non-expired XRPL credential
-- This is the Phase 1A backend enforcement gate.
-- In Phase 1B, native pDEX domain rules enforce the same constraints on-ledger.
CREATE OR REPLACE FUNCTION public.is_wallet_trade_enabled(p_wallet_address TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_wallets uw
    JOIN public.kyc_cases kc
      ON kc.user_id = uw.user_id
    JOIN public.wallet_registrations wr
      ON wr.wallet_id = uw.id
    JOIN public.wallet_credentials wc
      ON wc.wallet_id = uw.id
    WHERE uw.wallet_address = p_wallet_address
      AND uw.status = 'active'
      AND kc.status = 'approved'
      AND (kc.expires_at IS NULL OR kc.expires_at > now())
      AND wr.registration_status = 'approved'
      AND wc.ledger_status = 'accepted'
      AND (wc.expires_at IS NULL OR wc.expires_at > now())
  );
$$;

-- ── 7. Row Level Security ────────────────────────────────────

ALTER TABLE public.wallet_registrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_credentials           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_permission_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_profiles          ENABLE ROW LEVEL SECURITY;

-- wallet_registrations
CREATE POLICY "users_read_own_registrations" ON public.wallet_registrations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins_all_wallet_registrations" ON public.wallet_registrations
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );

-- wallet_credentials
CREATE POLICY "users_read_own_credentials" ON public.wallet_credentials
  FOR SELECT TO authenticated
  USING (
    wallet_id IN (
      SELECT id FROM public.user_wallets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_all_wallet_credentials" ON public.wallet_credentials
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );

-- wallet_permission_assignments
CREATE POLICY "users_read_own_permission_assignments" ON public.wallet_permission_assignments
  FOR SELECT TO authenticated
  USING (
    wallet_id IN (
      SELECT id FROM public.user_wallets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_all_permission_assignments" ON public.wallet_permission_assignments
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );

-- permission_profiles: all authenticated users can read; only admins can manage
CREATE POLICY "authenticated_read_profiles" ON public.permission_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins_manage_profiles" ON public.permission_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
