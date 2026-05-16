CREATE TABLE public.trustline_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  user_id uuid NOT NULL,
  currency text NOT NULL,
  issuer text NOT NULL,
  network text NOT NULL,
  funding_tx_hash text,
  trustline_tx_hash text,
  funded_amount_xrp numeric NOT NULL DEFAULT 0.5,
  status text NOT NULL DEFAULT 'funded',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_trustline_sponsorships_wallet_time
  ON public.trustline_sponsorships (wallet_address, created_at DESC);

ALTER TABLE public.trustline_sponsorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sponsorships"
  ON public.trustline_sponsorships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert sponsorships"
  ON public.trustline_sponsorships
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Service can update sponsorships"
  ON public.trustline_sponsorships
  FOR UPDATE
  TO public
  USING (true);