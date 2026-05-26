ALTER TABLE public.campaign_donations
  ADD COLUMN IF NOT EXISTS xrp_usd_rate numeric(20, 8),
  ADD COLUMN IF NOT EXISTS xrp_usd_value numeric(20, 6),
  ADD COLUMN IF NOT EXISTS xrp_usd_quoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS xrp_usd_source text;
