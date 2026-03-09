-- ============================================================
-- Wallet Registration Gate
--
-- 1. wallet_is_registered(address) — true when wallet has an
--    approved registration (simpler gate for INSERT policy)
-- 2. Updated token_orders INSERT policy to require registration
-- ============================================================

-- ── 1. wallet_is_registered() ───────────────────────────────
CREATE OR REPLACE FUNCTION public.wallet_is_registered(p_wallet_address TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wallet_registrations wr
    JOIN public.user_wallets uw ON uw.id = wr.wallet_id
    WHERE uw.wallet_address = p_wallet_address
      AND wr.registration_status = 'approved'
  );
$$;

-- ── 2. Update token_orders INSERT policy ─────────────────────
-- Adds registration gate alongside existing ownership check.
DROP POLICY IF EXISTS "Users can insert own orders" ON public.token_orders;

CREATE POLICY "Users can insert own orders"
  ON public.token_orders FOR INSERT TO authenticated
  WITH CHECK (
    public.owns_wallet(wallet_address)
    AND public.wallet_is_registered(wallet_address)
  );
