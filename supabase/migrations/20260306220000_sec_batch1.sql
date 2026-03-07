-- Batch 1 Security Fixes
-- SEC-004: Add intended_user_id to xaman_payloads to prevent wallet hijacking
-- SEC-003: Verify IDOR policies are in place (defensive re-drop + re-create)

-- =====================================================
-- SEC-004: Bind payload to creating user
-- =====================================================

ALTER TABLE public.xaman_payloads
  ADD COLUMN IF NOT EXISTS intended_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- =====================================================
-- SEC-003: Defensive cleanup — ensure old open policies
-- are gone and scoped ones are present on all 3 tables.
-- (These may already be dropped by a prior migration,
--  using IF EXISTS so it's safe to re-run.)
-- =====================================================

-- portfolio_holdings
DROP POLICY IF EXISTS "Anyone can read portfolio holdings"  ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Anyone can insert portfolio holdings" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Anyone can update portfolio holdings" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Anyone can delete portfolio holdings" ON public.portfolio_holdings;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='portfolio_holdings' AND policyname='Users can read own holdings'
  ) THEN
    CREATE POLICY "Users can read own holdings"
      ON public.portfolio_holdings FOR SELECT TO authenticated
      USING (public.owns_wallet(wallet_address));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='portfolio_holdings' AND policyname='Users can insert own holdings'
  ) THEN
    CREATE POLICY "Users can insert own holdings"
      ON public.portfolio_holdings FOR INSERT TO authenticated
      WITH CHECK (public.owns_wallet(wallet_address));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='portfolio_holdings' AND policyname='Users can update own holdings'
  ) THEN
    CREATE POLICY "Users can update own holdings"
      ON public.portfolio_holdings FOR UPDATE TO authenticated
      USING (public.owns_wallet(wallet_address))
      WITH CHECK (public.owns_wallet(wallet_address));
  END IF;
END $$;

-- portfolio_transactions
DROP POLICY IF EXISTS "Anyone can read portfolio transactions"  ON public.portfolio_transactions;
DROP POLICY IF EXISTS "Anyone can insert portfolio transactions" ON public.portfolio_transactions;
DROP POLICY IF EXISTS "Anyone can update portfolio transactions" ON public.portfolio_transactions;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='portfolio_transactions' AND policyname='Users can read own transactions'
  ) THEN
    CREATE POLICY "Users can read own transactions"
      ON public.portfolio_transactions FOR SELECT TO authenticated
      USING (public.owns_wallet(wallet_address));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='portfolio_transactions' AND policyname='Users can insert own transactions'
  ) THEN
    CREATE POLICY "Users can insert own transactions"
      ON public.portfolio_transactions FOR INSERT TO authenticated
      WITH CHECK (public.owns_wallet(wallet_address));
  END IF;
END $$;

-- token_orders
DROP POLICY IF EXISTS "Anyone can read token orders"   ON public.token_orders;
DROP POLICY IF EXISTS "Anyone can insert token orders"  ON public.token_orders;
DROP POLICY IF EXISTS "Anyone can update token orders"  ON public.token_orders;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='token_orders' AND policyname='Anyone can read token orders (public orderbook)'
  ) THEN
    -- Order book reads are intentionally public (marketplace)
    CREATE POLICY "Anyone can read token orders (public orderbook)"
      ON public.token_orders FOR SELECT
      USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='token_orders' AND policyname='Users can insert own orders'
  ) THEN
    CREATE POLICY "Users can insert own orders"
      ON public.token_orders FOR INSERT TO authenticated
      WITH CHECK (public.owns_wallet(wallet_address));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='token_orders' AND policyname='Users can update own orders'
  ) THEN
    CREATE POLICY "Users can update own orders"
      ON public.token_orders FOR UPDATE TO authenticated
      USING (public.owns_wallet(wallet_address))
      WITH CHECK (public.owns_wallet(wallet_address));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='token_orders' AND policyname='Users can delete own orders'
  ) THEN
    CREATE POLICY "Users can delete own orders"
      ON public.token_orders FOR DELETE TO authenticated
      USING (public.owns_wallet(wallet_address));
  END IF;
END $$;
