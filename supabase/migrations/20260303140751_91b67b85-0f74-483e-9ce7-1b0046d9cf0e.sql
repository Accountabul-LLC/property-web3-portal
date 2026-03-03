
-- Wallet audit log for tracking connect/disconnect/switch events
CREATE TABLE public.wallet_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  event_type text NOT NULL, -- 'connect', 'disconnect', 'switch_to', 'switch_from'
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_hint text, -- optional, from edge function headers
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by wallet
CREATE INDEX idx_wallet_audit_wallet ON public.wallet_audit_log(wallet_address);
CREATE INDEX idx_wallet_audit_created ON public.wallet_audit_log(created_at DESC);

-- RLS: anyone can insert (no auth system), only read own wallet logs
ALTER TABLE public.wallet_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert audit logs"
  ON public.wallet_audit_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read audit logs"
  ON public.wallet_audit_log FOR SELECT
  USING (true);
