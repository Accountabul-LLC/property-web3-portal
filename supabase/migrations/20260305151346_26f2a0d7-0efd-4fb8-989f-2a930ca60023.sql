
-- Create user_wallets table
CREATE TABLE public.user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  label text,
  xaman_account_name text,
  xaman_user_token text,
  avatar_url text,
  provider text NOT NULL DEFAULT 'xaman',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(wallet_address)
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wallets" ON public.user_wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own wallets" ON public.user_wallets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own wallets" ON public.user_wallets
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own wallets" ON public.user_wallets
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Add user_id to wallet_audit_log
ALTER TABLE public.wallet_audit_log ADD COLUMN user_id uuid REFERENCES auth.users(id);
