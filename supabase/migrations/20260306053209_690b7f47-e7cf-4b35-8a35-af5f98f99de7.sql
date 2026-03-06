
-- Fix the security definer view by making it use invoker security instead
DROP VIEW IF EXISTS public.user_wallets_safe;

CREATE VIEW public.user_wallets_safe
WITH (security_invoker = true)
AS
  SELECT id, user_id, wallet_address, label, xaman_account_name,
         provider, status, network, avatar_url, created_at, last_seen_at, revoked_at
  FROM public.user_wallets;
