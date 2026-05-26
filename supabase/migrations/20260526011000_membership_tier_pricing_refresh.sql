ALTER TABLE public.membership_tiers
  ADD COLUMN IF NOT EXISTS price_label text;

UPDATE public.membership_tiers
SET
  price_monthly = 16.00,
  price_annual = 160.00,
  description = 'For individual homeowners protecting their first property with a membership NFT and rewards access.',
  features = '["Membership NFT", "Member rewards access", "1 wallet registration", "1 tokenized property", "Deed monitoring for 1 property", "5 AI panel sessions per month", "Up to 5 XRPL transactions per month"]'::jsonb,
  highlight_feature = 'Membership NFT included',
  is_popular = false,
  sort_order = 1,
  cta_label = 'Get Started',
  price_label = null
WHERE slug = 'starter';

UPDATE public.membership_tiers
SET
  description = 'For active investors and small landlords building a rewards-enabled property stack.',
  features = '["Premium membership NFT", "Member rewards boosts", "Up to 3 tokenized properties", "Deed monitoring for all properties", "20 AI panel sessions per month", "Up to 20 XRPL transactions per month", "Priority support", "Fractional real estate access"]'::jsonb,
  highlight_feature = 'Best value for growing portfolios',
  cta_label = 'Coming Soon',
  price_label = 'TBD'
WHERE slug = 'professional';

UPDATE public.membership_tiers
SET
  description = 'For property developers and portfolio managers who want the full membership experience at scale.',
  features = '["Portfolio membership NFT", "Highest rewards tier", "Unlimited property tokenization", "Deed monitoring for up to 10 properties", "Unlimited AI panel sessions", "Unlimited XRPL transactions", "API access", "White-label deed certificates", "Fractional real estate access"]'::jsonb,
  highlight_feature = 'Built for scale',
  cta_label = 'Coming Soon',
  price_label = 'TBD'
WHERE slug = 'portfolio';
