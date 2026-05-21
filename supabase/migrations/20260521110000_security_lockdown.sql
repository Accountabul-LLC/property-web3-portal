-- Final security lockdown for token orders and compliance tables.
-- This removes the last permissive orderbook read path and makes the
-- wallet registration / permission tables explicitly service-admin only
-- for writes.

-- ------------------------------------------------------------
-- token_orders
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read token orders (public orderbook)" ON public.token_orders;
DROP POLICY IF EXISTS "Anyone can read token orders" ON public.token_orders;
DROP POLICY IF EXISTS "Authenticated can read token orders" ON public.token_orders;
DROP POLICY IF EXISTS "Users can read own token orders" ON public.token_orders;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'token_orders'
      AND policyname = 'Users can read own token orders'
  ) THEN
    CREATE POLICY "Users can read own token orders"
      ON public.token_orders FOR SELECT TO authenticated
      USING (
        public.owns_wallet(wallet_address)
        OR public.has_role(auth.uid(), 'admin')
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- security definer helpers
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_wallet(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_is_registered(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_wallet_trade_enabled(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_kyc_status(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_wallet(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wallet_is_registered(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_wallet_trade_enabled(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_kyc_status(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_saved_properties_for_wallet(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_credential_applications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_application_on_credential_accept() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_saved_properties_for_wallet(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_credential_applications() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_application_on_credential_accept() TO service_role;

-- ------------------------------------------------------------
-- token_price_history
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert price history" ON public.token_price_history;
DROP POLICY IF EXISTS "Authenticated can insert price history" ON public.token_price_history;
DROP POLICY IF EXISTS "Users can insert price history" ON public.token_price_history;

-- Read access stays as-is for market charts; writes are service-role only.

-- ------------------------------------------------------------
-- ai_agents
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can insert ai agents" ON public.ai_agents;
DROP POLICY IF EXISTS "Anyone can create AI agent records" ON public.ai_agents;
DROP POLICY IF EXISTS "Admins can insert ai agents" ON public.ai_agents;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_agents'
      AND policyname = 'Admins can insert ai agents'
  ) THEN
    CREATE POLICY "Admins can insert ai agents"
      ON public.ai_agents FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- wallet_permission_assignments
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Service can upsert permission assignments" ON public.wallet_permission_assignments;
DROP POLICY IF EXISTS "Service can update permission assignments" ON public.wallet_permission_assignments;
DROP POLICY IF EXISTS "Anyone can insert wallet permission assignments" ON public.wallet_permission_assignments;
DROP POLICY IF EXISTS "Anyone can update wallet permission assignments" ON public.wallet_permission_assignments;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallet_permission_assignments'
      AND policyname = 'users_read_own_permissions'
  ) THEN
    CREATE POLICY "users_read_own_permissions"
      ON public.wallet_permission_assignments FOR SELECT TO authenticated
      USING (
        wallet_id IN (
          SELECT id FROM public.user_wallets WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- wallet_registrations
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Service can insert wallet registrations" ON public.wallet_registrations;
DROP POLICY IF EXISTS "Service can update wallet registrations" ON public.wallet_registrations;
DROP POLICY IF EXISTS "Anyone can insert wallet registrations" ON public.wallet_registrations;
DROP POLICY IF EXISTS "Anyone can update wallet registrations" ON public.wallet_registrations;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallet_registrations'
      AND policyname = 'users_read_own_registrations'
  ) THEN
    CREATE POLICY "users_read_own_registrations"
      ON public.wallet_registrations FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ------------------------------------------------------------
-- wallet_audit_log
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.wallet_audit_log;
DROP POLICY IF EXISTS "authenticated_insert_audit_log" ON public.wallet_audit_log;
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.wallet_audit_log;

DROP POLICY IF EXISTS "Anyone can read audit logs" ON public.wallet_audit_log;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallet_audit_log'
      AND policyname = 'users_read_own_audit_logs'
  ) THEN
    CREATE POLICY "users_read_own_audit_logs"
      ON public.wallet_audit_log FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- token-logos storage
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload token logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can read token logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own token logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own token logos" ON storage.objects;

CREATE POLICY "Users can upload own token logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'token-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read token logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'token-logos');

CREATE POLICY "Users can update own token logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'token-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'token-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own token logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'token-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
