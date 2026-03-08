-- ============================================================
-- XRPL Issuer Wallets
-- Stores metadata for platform-controlled credential issuer wallets.
--
-- The actual private key / seed is NEVER stored here.
-- secret_env_key is the name of the Supabase project secret that
-- holds the seed — Edge Functions load it via Deno.env.get(secret_env_key).
--
-- For testnet:
--   secret_env_key = 'XRPL_TESTNET_ISSUER_SEED'
--   Set in: Supabase Dashboard → Edge Functions → Secrets
--
-- Also adds issuer_wallet_id FK to wallet_credentials so every
-- credential row is traceable to its signing issuer record.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.xrpl_issuer_wallets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  environment     TEXT        NOT NULL CHECK (environment IN ('testnet', 'mainnet')),
  issuer_name     TEXT        NOT NULL,           -- human label, e.g. 'accountabul_test_issuer'
  issuer_address  TEXT        NOT NULL UNIQUE,    -- XRPL r-address only — no secret here
  network         TEXT        NOT NULL DEFAULT 'testnet',
  status          TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'rotated', 'disabled')),
  secret_env_key  TEXT        NOT NULL,           -- pointer to Supabase secret, e.g. 'XRPL_TESTNET_ISSUER_SEED'
  notes           TEXT,
  created_by      UUID        REFERENCES auth.users(id),
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add issuer_wallet_id FK to wallet_credentials
ALTER TABLE public.wallet_credentials
  ADD COLUMN IF NOT EXISTS issuer_wallet_id UUID REFERENCES public.xrpl_issuer_wallets(id);

-- ── RLS ───────────────────────────────────────────────────────
-- Issuer wallet metadata is admin/compliance only.
-- No user ever needs to read the issuer table.
ALTER TABLE public.xrpl_issuer_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all_issuer_wallets" ON public.xrpl_issuer_wallets
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );
