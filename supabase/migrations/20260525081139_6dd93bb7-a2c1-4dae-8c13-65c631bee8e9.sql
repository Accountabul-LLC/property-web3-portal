DROP VIEW IF EXISTS public.campaign_donations_public;

CREATE OR REPLACE FUNCTION public.get_public_campaign_donations(p_campaign_id uuid)
RETURNS TABLE (
  id uuid,
  campaign_id uuid,
  amount numeric,
  currency text,
  donor_message text,
  is_anonymous boolean,
  escrow_status text,
  created_at timestamptz,
  donor_display_name text,
  donor_wallet_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.campaign_id,
    d.amount,
    d.currency,
    d.donor_message,
    d.is_anonymous,
    d.escrow_status,
    d.created_at,
    CASE WHEN d.is_anonymous THEN NULL ELSE d.donor_display_name END,
    CASE WHEN d.is_anonymous THEN NULL ELSE d.donor_wallet_address END
  FROM public.campaign_donations d
  WHERE d.campaign_id = p_campaign_id
    AND d.escrow_status IN ('escrowed','released')
  ORDER BY d.created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_campaign_donations(uuid) TO anon, authenticated;