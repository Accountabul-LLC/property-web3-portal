
-- subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text,
  product_id text,
  price_id text,
  status text NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX subscriptions_customer_idx ON public.subscriptions(stripe_customer_id);
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- pending_memberships (guest checkouts)
CREATE TABLE public.pending_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text,
  product_id text,
  price_id text,
  status text NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pending_memberships TO service_role;
ALTER TABLE public.pending_memberships ENABLE ROW LEVEL SECURITY;
-- no policies; service_role bypasses RLS
CREATE INDEX pending_memberships_email_idx ON public.pending_memberships(lower(email));
CREATE TRIGGER pending_memberships_set_updated_at BEFORE UPDATE ON public.pending_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- cancellation_audit
CREATE TABLE public.cancellation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text,
  stripe_refund_id text,
  original_amount_cents integer NOT NULL DEFAULT 0,
  refund_amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  cycle_start timestamptz,
  cycle_end timestamptz,
  days_used integer NOT NULL DEFAULT 0,
  days_remaining integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cancellation_audit TO authenticated;
GRANT ALL ON public.cancellation_audit TO service_role;
ALTER TABLE public.cancellation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own cancellation audit" ON public.cancellation_audit
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- membership_tiers columns for Stripe price lookup keys
ALTER TABLE public.membership_tiers
  ADD COLUMN IF NOT EXISTS stripe_price_lookup_monthly text,
  ADD COLUMN IF NOT EXISTS stripe_price_lookup_annual text;

-- Extend handle_new_user to claim pending memberships by email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'given_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'family_name', NULL)
  );

  -- Claim any pending memberships matching the new user's email
  INSERT INTO public.subscriptions (
    user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id,
    status, current_period_start, current_period_end, environment
  )
  SELECT
    NEW.id, pm.stripe_subscription_id, pm.stripe_customer_id, pm.product_id, pm.price_id,
    pm.status, pm.current_period_start, pm.current_period_end, pm.environment
  FROM public.pending_memberships pm
  WHERE lower(pm.email) = lower(NEW.email)
  ON CONFLICT (stripe_subscription_id) DO NOTHING;

  DELETE FROM public.pending_memberships WHERE lower(email) = lower(NEW.email);

  RETURN NEW;
END;
$function$;
