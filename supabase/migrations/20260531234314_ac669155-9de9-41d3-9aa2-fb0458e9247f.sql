-- 1. Add user_id column
ALTER TABLE public.saved_properties ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2. Backfill user_id from user_wallets
UPDATE public.saved_properties sp
SET user_id = uw.user_id
FROM public.user_wallets uw
WHERE uw.wallet_address = sp.wallet_address
  AND uw.status = 'active'
  AND sp.user_id IS NULL;

-- 3. Drop rows we can't attribute
DELETE FROM public.saved_properties WHERE user_id IS NULL;

-- 4. Constraints
ALTER TABLE public.saved_properties ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.saved_properties ALTER COLUMN wallet_address DROP NOT NULL;

-- Unique save per user/property
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_properties_user_property_unique'
  ) THEN
    ALTER TABLE public.saved_properties
      ADD CONSTRAINT saved_properties_user_property_unique UNIQUE (user_id, property_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS saved_properties_user_id_idx ON public.saved_properties(user_id);

-- 5. Replace RLS policies
DROP POLICY IF EXISTS "Users can read own saved properties" ON public.saved_properties;
DROP POLICY IF EXISTS "Users can insert own saved properties" ON public.saved_properties;
DROP POLICY IF EXISTS "Users can delete own saved properties" ON public.saved_properties;

CREATE POLICY "Users can read own saved properties"
  ON public.saved_properties FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own saved properties"
  ON public.saved_properties FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own saved properties"
  ON public.saved_properties FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6. Replace the lookup function
DROP FUNCTION IF EXISTS public.get_saved_properties_for_wallet(text);

CREATE OR REPLACE FUNCTION public.get_saved_properties_for_user()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  wallet_address text,
  property_id uuid,
  created_at timestamptz,
  properties jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.id,
    sp.user_id,
    sp.wallet_address,
    sp.property_id,
    sp.created_at,
    to_jsonb(p.*) AS properties
  FROM public.saved_properties sp
  LEFT JOIN public.properties p ON p.id = sp.property_id
  WHERE sp.user_id = auth.uid()
  ORDER BY sp.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_saved_properties_for_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saved_properties_for_user() TO authenticated, service_role;
