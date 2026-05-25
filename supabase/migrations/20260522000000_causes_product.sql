-- Causes Product: censorship-resistant crowdfunding on XRPL escrow
-- Tables: campaigns, campaign_donations

-- =====================================================
-- 1. campaigns
-- =====================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content
  title                   TEXT NOT NULL,
  slug                    TEXT NOT NULL UNIQUE,   -- URL-friendly, e.g. "free-marcus-2026"
  description             TEXT NOT NULL,
  image_url               TEXT,
  video_url               TEXT,                   -- optional embed

  -- Financial
  goal_amount             NUMERIC(20, 6),         -- soft goal, display only
  currency                TEXT NOT NULL DEFAULT 'XRP',
  recipient_wallet_address TEXT NOT NULL,         -- XRPL r-address funds go to

  -- Escrow timing
  release_date            TIMESTAMPTZ NOT NULL,   -- when EscrowFinish can be called

  -- Lifecycle
  status                  TEXT NOT NULL DEFAULT 'under_review'
                          CHECK (status IN ('under_review','approved','active','completed','rejected')),

  -- Submission
  submitted_by_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_email      TEXT,                   -- for non-users who contact team
  submission_notes        TEXT,                   -- applicant's message to the team

  -- Admin
  approved_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  admin_notes             TEXT,

  -- Stats (denormalized for fast display — updated by trigger)
  total_raised            NUMERIC(20, 6) NOT NULL DEFAULT 0,
  donor_count             INTEGER NOT NULL DEFAULT 0,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug must be lowercase alphanumeric + hyphens
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_slug_format
  CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- Fast lookups
CREATE INDEX IF NOT EXISTS campaigns_status_idx       ON public.campaigns (status);
CREATE INDEX IF NOT EXISTS campaigns_slug_idx         ON public.campaigns (slug);
CREATE INDEX IF NOT EXISTS campaigns_release_date_idx ON public.campaigns (release_date);


-- =====================================================
-- 2. campaign_donations
-- =====================================================

CREATE TABLE IF NOT EXISTS public.campaign_donations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  campaign_id             UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  -- Donor (nullable for anonymous on-chain donations we detect)
  donor_user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donor_wallet_address    TEXT NOT NULL,

  -- Amount
  amount                  NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency                TEXT NOT NULL DEFAULT 'XRP',

  -- XRPL Escrow
  xaman_payload_uuid      TEXT,                   -- Xaman signing payload
  escrow_tx_hash          TEXT,                   -- EscrowCreate tx hash on ledger
  escrow_sequence         INTEGER,                -- sender's account sequence (needed for EscrowFinish)
  escrow_finish_tx_hash   TEXT,                   -- EscrowFinish tx hash (set on release)

  -- Status
  escrow_status           TEXT NOT NULL DEFAULT 'pending'
                          CHECK (escrow_status IN ('pending','escrowed','released','cancelled')),

  -- Message from donor (optional, public or private)
  donor_message           TEXT,
  is_anonymous            BOOLEAN NOT NULL DEFAULT false,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_donations_campaign_idx   ON public.campaign_donations (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_donations_donor_idx      ON public.campaign_donations (donor_user_id);
CREATE INDEX IF NOT EXISTS campaign_donations_status_idx     ON public.campaign_donations (escrow_status);
CREATE INDEX IF NOT EXISTS campaign_donations_wallet_idx     ON public.campaign_donations (donor_wallet_address);


-- =====================================================
-- 3. Auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaigns_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS campaign_donations_updated_at ON public.campaign_donations;
CREATE TRIGGER campaign_donations_updated_at
  BEFORE UPDATE ON public.campaign_donations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =====================================================
-- 4. Trigger: keep total_raised + donor_count in sync
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_campaign_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.campaigns
  SET
    total_raised = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.campaign_donations
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id)
        AND escrow_status IN ('escrowed', 'released')
    ),
    donor_count = (
      SELECT COUNT(DISTINCT donor_wallet_address)
      FROM public.campaign_donations
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id)
        AND escrow_status IN ('escrowed', 'released')
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_campaign_stats ON public.campaign_donations;
CREATE TRIGGER sync_campaign_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.campaign_donations
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_stats();


-- =====================================================
-- 5. RLS
-- =====================================================

ALTER TABLE public.campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_donations ENABLE ROW LEVEL SECURITY;

-- campaigns: public can read active/completed; authenticated can submit; admins manage all
CREATE POLICY "public_read_active_campaigns"
  ON public.campaigns FOR SELECT
  USING (status IN ('active', 'completed'));

CREATE POLICY "admins_read_all_campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );

CREATE POLICY "authenticated_submit_campaign"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by_user_id = auth.uid()
    AND status = 'under_review'
  );

CREATE POLICY "admins_update_campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );

-- campaign_donations: donors see their own; admins see all; public sees non-anonymous escrowed donations
CREATE POLICY "public_read_escrowed_donations"
  ON public.campaign_donations FOR SELECT
  USING (escrow_status IN ('escrowed', 'released') AND is_anonymous = false);

CREATE POLICY "donors_read_own_donations"
  ON public.campaign_donations FOR SELECT TO authenticated
  USING (donor_user_id = auth.uid());

CREATE POLICY "authenticated_insert_donation"
  ON public.campaign_donations FOR INSERT TO authenticated
  WITH CHECK (donor_user_id = auth.uid());

CREATE POLICY "admins_read_all_donations"
  ON public.campaign_donations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );


-- =====================================================
-- 6. Seed: one example approved campaign
-- =====================================================

INSERT INTO public.campaigns (
  title,
  slug,
  description,
  image_url,
  goal_amount,
  currency,
  recipient_wallet_address,
  release_date,
  status,
  submitted_by_email,
  submission_notes,
  admin_notes
) VALUES (
  'Justice for Community Defense Fund',
  'justice-community-defense-fund',
  'This fund supports legal defense costs for community members who have been falsely accused or over-prosecuted. Every dollar raised goes directly to legal fees, bail, and family support — no platform takes a cut. Funds are held in XRPL escrow and released directly to the recipient wallet on the date below.',
  NULL,
  50000,
  'XRP',
  'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',  -- placeholder testnet address
  now() + INTERVAL '90 days',
  'active',
  'team@accountabul.com',
  'Inaugural campaign — Accountabul civil division approved.',
  'Approved by founding team. Seed campaign for platform launch.'
) ON CONFLICT (slug) DO NOTHING;
