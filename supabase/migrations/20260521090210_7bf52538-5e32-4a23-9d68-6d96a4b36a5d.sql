
-- 1. ai_agents: remove public insert, restrict to admins
DROP POLICY IF EXISTS "Authenticated can insert ai agents" ON public.ai_agents;
CREATE POLICY "Admins can insert ai agents"
  ON public.ai_agents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. token-logos storage: path-based ownership check
DROP POLICY IF EXISTS "Users can update own token logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own token logos" ON storage.objects;
CREATE POLICY "Users can update own token logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'token-logos' AND (storage.foldername(name))[1] = (auth.uid())::text)
  WITH CHECK (bucket_id = 'token-logos' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "Users can delete own token logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'token-logos' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- 3. token_orders: restrict SELECT to owner or admin
DROP POLICY IF EXISTS "Authenticated can read token orders" ON public.token_orders;
CREATE POLICY "Users can read own token orders"
  ON public.token_orders FOR SELECT TO authenticated
  USING (public.owns_wallet(wallet_address) OR public.has_role(auth.uid(), 'admin'));

-- 4. token_price_history: remove public insert (service role bypasses RLS)
DROP POLICY IF EXISTS "Anyone can insert price history" ON public.token_price_history;

-- 5. wallet_audit_log: remove public insert
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.wallet_audit_log;

-- 6. wallet_permission_assignments: remove public insert/update
DROP POLICY IF EXISTS "Service can upsert permission assignments" ON public.wallet_permission_assignments;
DROP POLICY IF EXISTS "Service can update permission assignments" ON public.wallet_permission_assignments;

-- 7. wallet_registrations: remove public insert/update
DROP POLICY IF EXISTS "Service can insert wallet registrations" ON public.wallet_registrations;
DROP POLICY IF EXISTS "Service can update wallet registrations" ON public.wallet_registrations;
