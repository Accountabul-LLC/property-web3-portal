
-- 1. Create a security definer function to check if a wallet belongs to the current user
CREATE OR REPLACE FUNCTION public.owns_wallet(_wallet_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_wallets
    WHERE user_id = auth.uid()
      AND wallet_address = _wallet_address
      AND status = 'active'
  )
$$;

-- =====================================================
-- 2. portfolio_holdings — scope to user's wallets
-- =====================================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can read portfolio holdings" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Anyone can insert portfolio holdings" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Anyone can update portfolio holdings" ON public.portfolio_holdings;

-- New scoped policies
CREATE POLICY "Users can read own holdings"
  ON public.portfolio_holdings FOR SELECT TO authenticated
  USING (public.owns_wallet(wallet_address));

CREATE POLICY "Users can insert own holdings"
  ON public.portfolio_holdings FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(wallet_address));

CREATE POLICY "Users can update own holdings"
  ON public.portfolio_holdings FOR UPDATE TO authenticated
  USING (public.owns_wallet(wallet_address))
  WITH CHECK (public.owns_wallet(wallet_address));

-- =====================================================
-- 3. portfolio_transactions — scope to user's wallets
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read portfolio transactions" ON public.portfolio_transactions;
DROP POLICY IF EXISTS "Anyone can insert portfolio transactions" ON public.portfolio_transactions;

CREATE POLICY "Users can read own transactions"
  ON public.portfolio_transactions FOR SELECT TO authenticated
  USING (public.owns_wallet(wallet_address));

CREATE POLICY "Users can insert own transactions"
  ON public.portfolio_transactions FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(wallet_address));

-- =====================================================
-- 4. saved_properties — scope to user's wallets
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read saved properties" ON public.saved_properties;
DROP POLICY IF EXISTS "Anyone can insert saved properties" ON public.saved_properties;
DROP POLICY IF EXISTS "Anyone can delete saved properties" ON public.saved_properties;

CREATE POLICY "Users can read own saved properties"
  ON public.saved_properties FOR SELECT TO authenticated
  USING (public.owns_wallet(wallet_address));

CREATE POLICY "Users can insert own saved properties"
  ON public.saved_properties FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(wallet_address));

CREATE POLICY "Users can delete own saved properties"
  ON public.saved_properties FOR DELETE TO authenticated
  USING (public.owns_wallet(wallet_address));

-- =====================================================
-- 5. token_orders — scope to user's wallets
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read token orders" ON public.token_orders;
DROP POLICY IF EXISTS "Anyone can insert token orders" ON public.token_orders;
DROP POLICY IF EXISTS "Anyone can update token orders" ON public.token_orders;

-- Orders need public READ for order book display, but restrict write
CREATE POLICY "Authenticated can read token orders"
  ON public.token_orders FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own orders"
  ON public.token_orders FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(wallet_address));

CREATE POLICY "Users can update own orders"
  ON public.token_orders FOR UPDATE TO authenticated
  USING (public.owns_wallet(wallet_address))
  WITH CHECK (public.owns_wallet(wallet_address));

-- =====================================================
-- 6. service_bookings — scope to user's wallets
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read service bookings" ON public.service_bookings;
DROP POLICY IF EXISTS "Anyone can insert service bookings" ON public.service_bookings;
DROP POLICY IF EXISTS "Anyone can update service bookings" ON public.service_bookings;

CREATE POLICY "Users can read own bookings"
  ON public.service_bookings FOR SELECT TO authenticated
  USING (public.owns_wallet(wallet_address));

CREATE POLICY "Users can insert own bookings"
  ON public.service_bookings FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(wallet_address));

CREATE POLICY "Users can update own bookings"
  ON public.service_bookings FOR UPDATE TO authenticated
  USING (public.owns_wallet(wallet_address))
  WITH CHECK (public.owns_wallet(wallet_address));

-- =====================================================
-- 7. newsletter_subscribers — restrict to admin only
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;

-- Anyone can subscribe (insert), but only admins can read
CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read subscribers"
  ON public.newsletter_subscribers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 8. wallet_audit_log — scope to own wallet or admin
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read audit logs" ON public.wallet_audit_log;
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.wallet_audit_log;

-- Keep insert open for edge functions (service role bypasses RLS anyway)
CREATE POLICY "Service can insert audit logs"
  ON public.wallet_audit_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read own audit logs"
  ON public.wallet_audit_log FOR SELECT TO authenticated
  USING (
    public.owns_wallet(wallet_address)
    OR public.has_role(auth.uid(), 'admin')
  );

-- =====================================================
-- 9. user_wallets — hide wallet_secret from client reads
--    (RLS already scopes to user_id = auth.uid(), which is correct)
--    Create a view that excludes sensitive fields
-- =====================================================

-- Note: user_wallets RLS is already correct (user_id = auth.uid())
-- The wallet_secret exposure is a column-level concern.
-- We'll handle this by creating a safe view.

CREATE OR REPLACE VIEW public.user_wallets_safe AS
  SELECT id, user_id, wallet_address, label, xaman_account_name,
         provider, status, network, avatar_url, created_at, last_seen_at, revoked_at
  FROM public.user_wallets;

-- =====================================================
-- 10. Tighten remaining permissive INSERT/UPDATE policies
-- =====================================================

-- property_documents: require authenticated
DROP POLICY IF EXISTS "Anyone can insert property documents" ON public.property_documents;
CREATE POLICY "Authenticated can insert property documents"
  ON public.property_documents FOR INSERT TO authenticated
  WITH CHECK (true);

-- property_reviews: require authenticated
DROP POLICY IF EXISTS "Anyone can insert property reviews" ON public.property_reviews;
CREATE POLICY "Authenticated can insert property reviews"
  ON public.property_reviews FOR INSERT TO authenticated
  WITH CHECK (true);

-- ai_agents: already restricted to authenticated

-- xaman_payloads: keep open for edge function flow (service role)
-- wallet_profiles: keep open for edge function flow (service role)
