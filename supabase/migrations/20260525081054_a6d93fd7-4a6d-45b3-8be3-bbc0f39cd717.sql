CREATE OR REPLACE VIEW public.campaign_donations_public
WITH (security_invoker = true) AS
SELECT
  id,
  campaign_id,
  amount,
  currency,
  donor_message,
  is_anonymous,
  escrow_status,
  created_at,
  CASE WHEN is_anonymous THEN NULL ELSE donor_display_name END AS donor_display_name,
  CASE WHEN is_anonymous THEN NULL ELSE donor_wallet_address END AS donor_wallet_address
FROM public.campaign_donations
WHERE escrow_status IN ('escrowed','released');

GRANT SELECT ON public.campaign_donations_public TO anon, authenticated;