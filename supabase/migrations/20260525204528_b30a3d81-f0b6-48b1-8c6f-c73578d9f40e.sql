-- Add visibility column to campaigns for admin take-down
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_reason text,
  ADD COLUMN IF NOT EXISTS hidden_by uuid;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_visibility_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_visibility_check CHECK (visibility IN ('public','hidden'));

-- Replace public read policy to also require visibility = 'public'
DROP POLICY IF EXISTS public_read_active_campaigns ON public.campaigns;
CREATE POLICY public_read_active_campaigns
  ON public.campaigns
  FOR SELECT
  TO public
  USING (status IN ('active','completed') AND visibility = 'public');