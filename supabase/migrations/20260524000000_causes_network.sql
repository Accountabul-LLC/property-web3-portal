-- Causes Product: add network routing for campaign explorer links

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'mainnet';

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_network_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_network_check
  CHECK (network IN ('mainnet', 'testnet'));

UPDATE public.campaigns
SET network = 'testnet'
WHERE slug = 'justice-community-defense-fund';

