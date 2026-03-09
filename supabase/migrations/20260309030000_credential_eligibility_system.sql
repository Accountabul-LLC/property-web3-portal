-- ============================================================
-- Credential Eligibility System
-- Adds: verification_artifacts, credential_requirements,
--       credential_eligibility, credential_class on catalog,
--       DB trigger to sync application status on acceptance
-- ============================================================

-- ── 1. Add credential_class to credential_catalog ────────────
ALTER TABLE public.credential_catalog
  ADD COLUMN IF NOT EXISTS credential_class TEXT NOT NULL DEFAULT 'B'
    CHECK (credential_class IN ('A', 'B'));

UPDATE public.credential_catalog SET credential_class = 'A'
  WHERE credential_key IN ('verified_user','property_lister','token_trader','service_provider');
UPDATE public.credential_catalog SET credential_class = 'B'
  WHERE credential_key IN ('vendor','appraiser','notary');

-- ── 2. Add metadata to kyc_documents if missing ──────────────
ALTER TABLE public.kyc_documents
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ── 3. verification_artifacts ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_artifacts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artifact_type       TEXT        NOT NULL
    CHECK (artifact_type IN (
      'kyc_approved','wallet_registered','wallet_ownership_proven',
      'account_type_individual','account_type_business',
      'kyc_document_uploaded','gov_id_uploaded','proof_of_address_uploaded',
      'business_registration_doc','professional_license_doc','professional_bio_submitted'
    )),
  artifact_subtype    TEXT,
  source_table        TEXT,
  source_id           UUID,
  value               JSONB,
  is_valid            BOOLEAN     NOT NULL DEFAULT true,
  invalidated_at      TIMESTAMPTZ,
  invalidation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, artifact_type, artifact_subtype)
);

ALTER TABLE public.verification_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_artifacts" ON public.verification_artifacts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins_all_artifacts" ON public.verification_artifacts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance_officer'));
CREATE POLICY "service_write_artifacts" ON public.verification_artifacts
  FOR ALL TO service_role WITH CHECK (true);

-- ── 4. credential_requirements ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.credential_requirements (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_key    TEXT        NOT NULL REFERENCES public.credential_catalog(credential_key) ON DELETE CASCADE,
  requirement_key   TEXT        NOT NULL,
  artifact_type     TEXT        NOT NULL,
  artifact_subtype  TEXT,
  check_mode        TEXT        NOT NULL CHECK (check_mode IN ('auto','manual')),
  display_label     TEXT        NOT NULL,
  display_hint      TEXT,
  is_blocking       BOOLEAN     NOT NULL DEFAULT true,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(credential_key, requirement_key)
);

ALTER TABLE public.credential_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_requirements" ON public.credential_requirements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins_manage_requirements" ON public.credential_requirements
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Seed requirements
INSERT INTO public.credential_requirements (credential_key, requirement_key, artifact_type, check_mode, display_label, display_hint, sort_order) VALUES
  ('verified_user','kyc_approved','kyc_approved','auto','KYC Approved','Complete identity verification',10),
  ('verified_user','wallet_registered','wallet_registered','auto','Wallet Registered','Register a wallet',20),
  ('verified_user','wallet_ownership','wallet_ownership_proven','auto','Wallet Ownership Proven','Verify wallet ownership',30),
  ('property_lister','kyc_approved','kyc_approved','auto','KYC Approved','Complete identity verification',10),
  ('property_lister','wallet_registered','wallet_registered','auto','Wallet Registered','Register a wallet',20),
  ('property_lister','wallet_ownership','wallet_ownership_proven','auto','Wallet Ownership Proven','Verify wallet ownership',30),
  ('token_trader','kyc_approved','kyc_approved','auto','KYC Approved','Complete identity verification',10),
  ('token_trader','wallet_registered','wallet_registered','auto','Wallet Registered','Register a wallet',20),
  ('token_trader','wallet_ownership','wallet_ownership_proven','auto','Wallet Ownership Proven','Verify wallet ownership',30),
  ('service_provider','kyc_approved','kyc_approved','auto','KYC Approved','Complete identity verification',10),
  ('service_provider','wallet_registered','wallet_registered','auto','Wallet Registered','Register a wallet',20),
  ('service_provider','wallet_ownership','wallet_ownership_proven','auto','Wallet Ownership Proven','Verify wallet ownership',30),
  ('service_provider','business_account','account_type_business','auto','Business Account','Switch to a business account',40)
ON CONFLICT (credential_key, requirement_key) DO NOTHING;

INSERT INTO public.credential_requirements (credential_key, requirement_key, artifact_type, artifact_subtype, check_mode, display_label, display_hint, sort_order) VALUES
  ('vendor','kyc_approved','kyc_approved',NULL,'auto','KYC Approved','Complete identity verification',10),
  ('vendor','wallet_registered','wallet_registered',NULL,'auto','Wallet Registered','Register a wallet',20),
  ('vendor','wallet_ownership','wallet_ownership_proven',NULL,'auto','Wallet Ownership Proven','Verify wallet ownership',30),
  ('vendor','business_account','account_type_business',NULL,'auto','Business Account','Switch to a business account',40),
  ('vendor','business_reg_doc','business_registration_doc','business_reg','manual','Business Registration','Upload your business registration document',50),
  ('appraiser','kyc_approved','kyc_approved',NULL,'auto','KYC Approved','Complete identity verification',10),
  ('appraiser','wallet_registered','wallet_registered',NULL,'auto','Wallet Registered','Register a wallet',20),
  ('appraiser','wallet_ownership','wallet_ownership_proven',NULL,'auto','Wallet Ownership Proven','Verify wallet ownership',30),
  ('appraiser','business_account','account_type_business',NULL,'auto','Business Account','Switch to a business account',40),
  ('appraiser','professional_license','professional_license_doc','appraiser_license','manual','Appraiser License','Upload your certified appraiser license',50),
  ('appraiser','professional_bio','professional_bio_submitted',NULL,'auto','Professional Bio','Complete your professional profile',60),
  ('notary','kyc_approved','kyc_approved',NULL,'auto','KYC Approved','Complete identity verification',10),
  ('notary','wallet_registered','wallet_registered',NULL,'auto','Wallet Registered','Register a wallet',20),
  ('notary','wallet_ownership','wallet_ownership_proven',NULL,'auto','Wallet Ownership Proven','Verify wallet ownership',30),
  ('notary','business_account','account_type_business',NULL,'auto','Business Account','Switch to a business account',40),
  ('notary','notary_license','professional_license_doc','notary_license','manual','Notary Commission','Upload your notary commission',50),
  ('notary','professional_bio','professional_bio_submitted',NULL,'auto','Professional Bio','Complete your professional profile',60)
ON CONFLICT (credential_key, requirement_key) DO NOTHING;

-- ── 5. credential_eligibility ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credential_eligibility (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address          TEXT        NOT NULL,
  credential_key          TEXT        NOT NULL REFERENCES public.credential_catalog(credential_key),
  ui_section              TEXT        NOT NULL
    CHECK (ui_section IN ('active','ready_to_accept','auto_issuable','eligible_apply','needs_more_info','unavailable')),
  requirements_snapshot   JSONB       NOT NULL DEFAULT '[]',
  all_auto_met            BOOLEAN     NOT NULL DEFAULT false,
  has_manual_requirements BOOLEAN     NOT NULL DEFAULT false,
  all_blocking_met        BOOLEAN     NOT NULL DEFAULT false,
  blocking_reasons        TEXT[]      NOT NULL DEFAULT '{}',
  computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, credential_key, wallet_address)
);

ALTER TABLE public.credential_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_eligibility" ON public.credential_eligibility
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "service_write_eligibility" ON public.credential_eligibility
  FOR ALL TO service_role WITH CHECK (true);
CREATE POLICY "admins_read_all_eligibility" ON public.credential_eligibility
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance_officer'));

-- ── 6. Trigger: sync credential_applications when credential accepted ──
CREATE OR REPLACE FUNCTION public.sync_application_on_credential_accept()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ledger_status = 'accepted' AND OLD.ledger_status != 'accepted' THEN
    UPDATE public.credential_applications
    SET status = 'active', accepted_at = now(), updated_at = now()
    WHERE wallet_credential_id = NEW.id
      AND status = 'issued_pending_acceptance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_credential_accepted ON public.wallet_credentials;
CREATE TRIGGER on_credential_accepted
  AFTER UPDATE ON public.wallet_credentials
  FOR EACH ROW EXECUTE FUNCTION public.sync_application_on_credential_accept();

-- ── 7. Function: expire stale applications (called by evaluate fn) ──
CREATE OR REPLACE FUNCTION public.expire_stale_credential_applications()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated INTEGER;
BEGIN
  UPDATE public.credential_applications
  SET status = 'expired', updated_at = now()
  WHERE status = 'issued_pending_acceptance' AND expires_at < now();
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;
