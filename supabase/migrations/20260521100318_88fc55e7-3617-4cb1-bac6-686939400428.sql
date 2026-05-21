-- Revoke client-side access to wallet_secret column.
-- Edge functions use the service role and bypass these grants.
REVOKE SELECT (wallet_secret), UPDATE (wallet_secret), INSERT (wallet_secret)
  ON public.user_wallets FROM authenticated, anon;

-- Re-grant access to all other columns so existing client queries keep working.
GRANT SELECT (
  id, user_id, wallet_address, xaman_account_name, xaman_user_token,
  avatar_url, provider, status, created_at, last_seen_at, revoked_at,
  network, label
) ON public.user_wallets TO authenticated;

GRANT INSERT (
  id, user_id, wallet_address, xaman_account_name, xaman_user_token,
  avatar_url, provider, status, created_at, last_seen_at, revoked_at,
  network, label
) ON public.user_wallets TO authenticated;

GRANT UPDATE (
  xaman_account_name, xaman_user_token, avatar_url, status,
  last_seen_at, revoked_at, label, network
) ON public.user_wallets TO authenticated;