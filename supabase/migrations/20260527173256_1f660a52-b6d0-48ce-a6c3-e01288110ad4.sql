ALTER TABLE public.membership_tiers
  ADD COLUMN IF NOT EXISTS price_label text;

UPDATE public.membership_tiers
SET
  price_monthly = 16,
  price_annual = 160,
  price_label = null,
  cta_label = 'Start for $16/mo',
  updated_at = now()
WHERE slug = 'starter';

UPDATE public.membership_tiers
SET
  price_monthly = 0,
  price_annual = null,
  price_label = 'TBD',
  cta_label = 'Join Waitlist',
  updated_at = now()
WHERE slug = 'pro';

UPDATE public.membership_tiers
SET
  price_monthly = 0,
  price_annual = null,
  price_label = 'TBD',
  cta_label = 'Contact Team',
  updated_at = now()
WHERE slug = 'enterprise';