
-- 1. Add property_id FK to token_mints
ALTER TABLE public.token_mints 
  ADD COLUMN property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL;

-- 2. Update RLS policy on properties to also show 'active' status publicly
DROP POLICY IF EXISTS "Public can read approved properties" ON public.properties;
CREATE POLICY "Public can read listed properties"
  ON public.properties
  FOR SELECT
  USING (status IN ('approved', 'active'));
