
CREATE TABLE public.token_mints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  token_type text NOT NULL,
  network text NOT NULL DEFAULT 'testnet',
  request_json jsonb DEFAULT '{}'::jsonb,
  tx_json jsonb,
  status text NOT NULL DEFAULT 'draft',
  tx_hash text,
  xaman_payload_uuid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.token_mints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mints"
  ON public.token_mints FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own mints"
  ON public.token_mints FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own mints"
  ON public.token_mints FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
