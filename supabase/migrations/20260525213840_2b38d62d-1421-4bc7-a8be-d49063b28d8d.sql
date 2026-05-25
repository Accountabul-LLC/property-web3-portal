ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS accepted_assets text[] NOT NULL DEFAULT ARRAY['XRP']::text[];

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_accepted_assets_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_accepted_assets_check
  CHECK (
    array_length(accepted_assets, 1) >= 1
    AND accepted_assets <@ ARRAY['XRP','RLUSD']::text[]
  );