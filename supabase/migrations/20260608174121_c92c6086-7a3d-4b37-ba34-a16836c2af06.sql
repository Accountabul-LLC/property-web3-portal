
-- 1. Schema additions
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listing_kind text NOT NULL DEFAULT 'tokenized',
  ADD COLUMN IF NOT EXISTS listing_price numeric,
  ADD COLUMN IF NOT EXISTS vendor_profile_id uuid REFERENCES public.vendor_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- Constrain listing_kind values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_listing_kind_check'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_listing_kind_check CHECK (listing_kind IN ('standard','tokenized'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS properties_listing_kind_idx ON public.properties(listing_kind);
CREATE INDEX IF NOT EXISTS properties_vendor_profile_id_idx ON public.properties(vendor_profile_id);

-- 2. RLS policy: vendors with a business profile can insert standard listings
DROP POLICY IF EXISTS "Vendors can insert standard listings" ON public.properties;
CREATE POLICY "Vendors can insert standard listings"
  ON public.properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND listing_kind = 'standard'
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.user_id = auth.uid()
        AND vp.id = properties.vendor_profile_id
    )
  );
