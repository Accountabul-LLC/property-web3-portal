-- Create vendor_products table
CREATE TABLE public.vendor_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  image_url text,
  category text,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_products_vendor ON public.vendor_products(vendor_profile_id, is_published, sort_order);
CREATE INDEX idx_vendor_products_user ON public.vendor_products(user_id);

GRANT SELECT ON public.vendor_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_products TO authenticated;
GRANT ALL ON public.vendor_products TO service_role;

ALTER TABLE public.vendor_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published products"
ON public.vendor_products FOR SELECT
TO anon, authenticated
USING (is_published = true);

CREATE POLICY "Owners can read own products"
ON public.vendor_products FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can read all products"
ON public.vendor_products FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can insert own products"
ON public.vendor_products FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND vendor_profile_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Owners can update own products"
ON public.vendor_products FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete own products"
ON public.vendor_products FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all products"
ON public.vendor_products FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER vendor_products_set_updated_at
BEFORE UPDATE ON public.vendor_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recreate vendor_public_profiles view to include created_at
DROP VIEW IF EXISTS public.vendor_public_profiles;
CREATE VIEW public.vendor_public_profiles AS
SELECT
  id,
  slug,
  company_name,
  logo_url,
  business_email,
  business_phone,
  website_url,
  industry AS industry_category,
  vendor_bio AS business_description,
  service_areas,
  business_address_city,
  business_address_state,
  business_address_zip,
  years_in_business,
  verification_tier,
  profile_headline,
  public_profile_enabled,
  verification_status,
  created_at
FROM public.vendor_profiles vp
WHERE public_profile_enabled = true
  AND slug IS NOT NULL
  AND verification_status <> ALL (ARRAY['denied'::text, 'suspended'::text]);

GRANT SELECT ON public.vendor_public_profiles TO anon, authenticated;