
-- =====================================================
-- campaigns
-- =====================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   TEXT NOT NULL,
  slug                    TEXT NOT NULL UNIQUE,
  description             TEXT NOT NULL,
  image_url               TEXT,
  video_url               TEXT,
  goal_amount             NUMERIC(20, 6),
  currency                TEXT NOT NULL DEFAULT 'XRP',
  recipient_wallet_address TEXT NOT NULL,
  release_date            TIMESTAMPTZ NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'under_review'
                          CHECK (status IN ('under_review','approved','active','completed','rejected')),
  network                 TEXT NOT NULL DEFAULT 'testnet'
                          CHECK (network IN ('testnet','mainnet','devnet')),
  submitted_by_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_email      TEXT,
  submission_notes        TEXT,
  approved_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  admin_notes             TEXT,
  total_raised            NUMERIC(20, 6) NOT NULL DEFAULT 0,
  donor_count             INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS campaigns_status_idx       ON public.campaigns (status);
CREATE INDEX IF NOT EXISTS campaigns_slug_idx         ON public.campaigns (slug);
CREATE INDEX IF NOT EXISTS campaigns_release_date_idx ON public.campaigns (release_date);
CREATE INDEX IF NOT EXISTS campaigns_network_idx      ON public.campaigns (network);

-- =====================================================
-- campaign_donations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.campaign_donations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  donor_user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donor_wallet_address    TEXT NOT NULL,
  amount                  NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency                TEXT NOT NULL DEFAULT 'XRP',
  xaman_payload_uuid      TEXT,
  escrow_tx_hash          TEXT,
  escrow_sequence         INTEGER,
  escrow_finish_tx_hash   TEXT,
  escrow_status           TEXT NOT NULL DEFAULT 'pending'
                          CHECK (escrow_status IN ('pending','escrowed','released','cancelled')),
  donor_message           TEXT,
  is_anonymous            BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_donations_campaign_idx ON public.campaign_donations (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_donations_donor_idx    ON public.campaign_donations (donor_user_id);
CREATE INDEX IF NOT EXISTS campaign_donations_status_idx   ON public.campaign_donations (escrow_status);
CREATE INDEX IF NOT EXISTS campaign_donations_wallet_idx   ON public.campaign_donations (donor_wallet_address);

-- =====================================================
-- updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
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
-- stats trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_campaign_stats()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.campaigns
  SET
    total_raised = (
      SELECT COALESCE(SUM(amount), 0) FROM public.campaign_donations
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id)
        AND escrow_status IN ('escrowed','released')
    ),
    donor_count = (
      SELECT COUNT(DISTINCT donor_wallet_address) FROM public.campaign_donations
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id)
        AND escrow_status IN ('escrowed','released')
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
-- RLS
-- =====================================================
ALTER TABLE public.campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_campaigns" ON public.campaigns;
CREATE POLICY "public_read_active_campaigns"
  ON public.campaigns FOR SELECT
  USING (status IN ('active','completed'));

DROP POLICY IF EXISTS "admins_read_all_campaigns" ON public.campaigns;
CREATE POLICY "admins_read_all_campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins_insert_campaigns" ON public.campaigns;
CREATE POLICY "admins_insert_campaigns"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins_update_campaigns" ON public.campaigns;
CREATE POLICY "admins_update_campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins_delete_campaigns" ON public.campaigns;
CREATE POLICY "admins_delete_campaigns"
  ON public.campaigns FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "public_read_escrowed_donations" ON public.campaign_donations;
CREATE POLICY "public_read_escrowed_donations"
  ON public.campaign_donations FOR SELECT
  USING (escrow_status IN ('escrowed','released') AND is_anonymous = false);

DROP POLICY IF EXISTS "donors_read_own_donations" ON public.campaign_donations;
CREATE POLICY "donors_read_own_donations"
  ON public.campaign_donations FOR SELECT TO authenticated
  USING (donor_user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_insert_donation" ON public.campaign_donations;
CREATE POLICY "authenticated_insert_donation"
  ON public.campaign_donations FOR INSERT TO authenticated
  WITH CHECK (donor_user_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_all_donations" ON public.campaign_donations;
CREATE POLICY "admins_read_all_donations"
  ON public.campaign_donations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- =====================================================
-- Storage bucket: campaign-images
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-images', 'campaign-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "campaign_images_public_read" ON storage.objects;
CREATE POLICY "campaign_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-images');

DROP POLICY IF EXISTS "campaign_images_admin_write" ON storage.objects;
CREATE POLICY "campaign_images_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-images' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "campaign_images_admin_update" ON storage.objects;
CREATE POLICY "campaign_images_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-images' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "campaign_images_admin_delete" ON storage.objects;
CREATE POLICY "campaign_images_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-images' AND public.has_role(auth.uid(),'admin'));

-- =====================================================
-- Seed: Donate to Accountabul
-- =====================================================
INSERT INTO public.campaigns (
  title, slug, description, image_url,
  goal_amount, currency, recipient_wallet_address,
  release_date, status, network, admin_notes
) VALUES (
  'Donate to Accountabul',
  'donate-to-accountabul',
  'Support the Accountabul platform and the civil division''s work building censorship-resistant tools for justice, community defense, and on-chain transparency. Every XRP raised goes directly into XRPL escrow and releases to the team wallet on the scheduled date — no middleman, no platform cut.',
  NULL, 1000, 'XRP',
  'rHsehLToQL7puJCkmk2dne53iXX2K6LffW',
  now() + INTERVAL '30 days',
  'active', 'testnet',
  'Seed campaign for admin-launched flow.'
) ON CONFLICT (slug) DO NOTHING;
