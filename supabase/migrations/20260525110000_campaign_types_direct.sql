-- Add campaign type support for escrow vs direct evergreen campaigns.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT 'escrow';

ALTER TABLE public.campaigns
  ALTER COLUMN release_date DROP NOT NULL;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_campaign_type_check
      CHECK (campaign_type IN ('escrow', 'direct'));
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

UPDATE public.campaigns
SET campaign_type = COALESCE(campaign_type, 'escrow')
WHERE campaign_type IS NULL;

UPDATE public.campaigns
SET release_date = NULL
WHERE campaign_type = 'direct';
