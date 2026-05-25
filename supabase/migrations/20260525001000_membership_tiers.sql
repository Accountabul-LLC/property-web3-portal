-- Membership tiers: DB-driven pricing, admin-editable
CREATE TABLE public.membership_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price_monthly numeric(10,2) NOT NULL,
  price_annual numeric(10,2),
  description text,
  features jsonb NOT NULL DEFAULT '[]',
  highlight_feature text,
  is_popular boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  cta_label text NOT NULL DEFAULT 'Get Started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active tiers"
  ON public.membership_tiers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage tiers"
  ON public.membership_tiers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

INSERT INTO public.membership_tiers (name, slug, price_monthly, price_annual, description, features, highlight_feature, is_popular, sort_order, cta_label)
VALUES
  (
    'Starter', 'starter', 19.00, 190.00,
    'For individual homeowners protecting their first property.',
    '["1 identity verification (KYC)", "1 wallet registration", "1 tokenized property", "Deed monitoring for 1 property", "5 AI panel sessions per month", "Up to 5 XRPL transactions per month"]'::jsonb,
    'Deed fraud monitoring included',
    false, 1, 'Get Started'
  ),
  (
    'Professional', 'professional', 49.00, 490.00,
    'For active investors and small landlords managing multiple properties.',
    '["3 identity verifications (KYC)", "3 wallet registrations", "Up to 3 tokenized properties", "Deed monitoring for all properties", "20 AI panel sessions per month", "Up to 20 XRPL transactions per month", "Priority support"]'::jsonb,
    'Best value for small portfolios',
    true, 2, 'Get Started'
  ),
  (
    'Portfolio', 'portfolio', 99.00, 990.00,
    'For property developers and portfolio managers at scale.',
    '["Unlimited KYC verifications", "10 wallet registrations", "Unlimited property tokenization", "Deed monitoring for up to 10 properties", "Unlimited AI panel sessions", "Unlimited XRPL transactions", "API access", "White-label deed certificates"]'::jsonb,
    'Everything unlimited',
    false, 3, 'Get Started'
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_tier_id uuid REFERENCES public.membership_tiers(id) ON DELETE SET NULL;
