-- Return a user's saved homes with property details, even when the property
-- is no longer visible through the public properties RLS policy.
CREATE OR REPLACE FUNCTION public.get_saved_properties_for_wallet(p_wallet_address text)
RETURNS TABLE (
  id uuid,
  wallet_address text,
  property_id uuid,
  created_at timestamptz,
  properties jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.id,
    sp.wallet_address,
    sp.property_id,
    sp.created_at,
    CASE
      WHEN p.id IS NULL THEN NULL
      ELSE to_jsonb(p)
    END AS properties
  FROM public.saved_properties sp
  LEFT JOIN public.properties p
    ON p.id = sp.property_id
  WHERE sp.wallet_address = p_wallet_address
    AND public.owns_wallet(p_wallet_address)
  ORDER BY sp.created_at DESC;
$$;
