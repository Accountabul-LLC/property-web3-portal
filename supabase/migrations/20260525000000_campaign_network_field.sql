-- campaign network field
-- Adds network column to campaigns table so campaign-release can auto-select
-- the correct XRPL nodes instead of hardcoding 'testnet'.
-- Safe default: existing rows get 'testnet', no data loss.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'testnet'
  CHECK (network IN ('testnet', 'mainnet', 'devnet'));

CREATE INDEX IF NOT EXISTS campaigns_network_idx ON public.campaigns (network);
