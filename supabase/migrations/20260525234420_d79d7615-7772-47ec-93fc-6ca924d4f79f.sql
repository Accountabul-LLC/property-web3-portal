
-- Drop the view; switch to column-level GRANTs
DROP VIEW IF EXISTS public.campaigns_public;

-- Restore a row-level public read policy (safe columns only via GRANTs below)
CREATE POLICY "public_read_active_campaigns"
ON public.campaigns
FOR SELECT
TO anon, authenticated
USING (
  status IN ('active','completed') AND visibility = 'public'
);

-- Revoke broad SELECT and re-grant only safe columns to anon/authenticated
REVOKE SELECT ON public.campaigns FROM anon, authenticated;

GRANT SELECT (
  id, title, slug, description, image_url, gallery_urls, video_url,
  network, campaign_mode, default_release_offset_days,
  goal_amount, currency, accepted_assets,
  recipient_wallet_address, release_date, status, visibility,
  total_raised, donor_count, created_at, updated_at
) ON public.campaigns TO anon, authenticated;

-- Service role retains full access for admin edge functions
GRANT SELECT ON public.campaigns TO service_role;

-- Admin listing RPC (SECURITY DEFINER) so the admin UI can still read everything
CREATE OR REPLACE FUNCTION public.admin_list_campaigns()
RETURNS SETOF public.campaigns
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.campaigns ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_campaigns() TO authenticated;
