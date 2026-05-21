-- Security fixes: patch critical RLS issues found in audit
-- Covers: xaman_payloads hijacking, wallet_credentials open insert,
--         wallet_permission_assignments open insert, wallet_profiles anon write,
--         wallet_audit_log anon insert

-- =====================================================
-- 1. xaman_payloads
--    Old: open to anon (SELECT/INSERT/UPDATE with true)
--    New: authenticated users see only their own payloads
-- =====================================================

DROP POLICY IF EXISTS "System can manage Xaman payloads"  ON public.xaman_payloads;
DROP POLICY IF EXISTS "Anon can insert xaman payloads"    ON public.xaman_payloads;
DROP POLICY IF EXISTS "Anon can select xaman payloads"    ON public.xaman_payloads;
DROP POLICY IF EXISTS "Anon can update xaman payloads"    ON public.xaman_payloads;

-- Admins/compliance officers can read all payloads (needed for polling after signing)
CREATE POLICY "admins_read_all_payloads"
  ON public.xaman_payloads FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );

-- Users can read their own payloads (NULL intended_user_id = legacy, skip)
CREATE POLICY "users_read_own_payloads"
  ON public.xaman_payloads FOR SELECT TO authenticated
  USING (intended_user_id = auth.uid());

-- Service role handles all inserts/updates via edge functions (bypasses RLS)
-- No permissive insert/update policy needed for regular users


-- =====================================================
-- 2. wallet_credentials
--    Old: WITH CHECK (true) — any authenticated user can insert
--    New: service_role only (edge functions use service role key)
-- =====================================================

DROP POLICY IF EXISTS "Service can insert credentials"  ON public.wallet_credentials;
DROP POLICY IF EXISTS "Service can update credentials"  ON public.wallet_credentials;

-- Users can read their own wallet credentials
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_credentials' AND policyname = 'users_read_own_credentials'
  ) THEN
    CREATE POLICY "users_read_own_credentials"
      ON public.wallet_credentials FOR SELECT TO authenticated
      USING (
        wallet_id IN (
          SELECT id FROM public.user_wallets WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- service_role bypasses RLS by default in Supabase — no insert/update policy needed


-- =====================================================
-- 3. wallet_permission_assignments
--    Old: WITH CHECK (true) — any authenticated user can insert/update
--    New: service_role only
-- =====================================================

DROP POLICY IF EXISTS "Service can upsert permission assignments"  ON public.wallet_permission_assignments;
DROP POLICY IF EXISTS "Service can update permission assignments"  ON public.wallet_permission_assignments;

-- Users can read their own permission assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_permission_assignments' AND policyname = 'users_read_own_permissions'
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


-- =====================================================
-- 4. wallet_profiles
--    Old: anon can insert/update (no auth required)
--    New: authenticated only, own profile
-- =====================================================

DROP POLICY IF EXISTS "Anon can insert wallet profiles"  ON public.wallet_profiles;
DROP POLICY IF EXISTS "Anon can update wallet profiles"  ON public.wallet_profiles;
DROP POLICY IF EXISTS "Anyone can insert wallet profiles" ON public.wallet_profiles;
DROP POLICY IF EXISTS "Anyone can update wallet profiles" ON public.wallet_profiles;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_profiles' AND policyname = 'authenticated_insert_own_wallet_profile'
  ) THEN
    CREATE POLICY "authenticated_insert_own_wallet_profile"
      ON public.wallet_profiles FOR INSERT TO authenticated
      WITH CHECK (
        wallet_address IN (
          SELECT wallet_address FROM public.user_wallets WHERE user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_profiles' AND policyname = 'authenticated_update_own_wallet_profile'
  ) THEN
    CREATE POLICY "authenticated_update_own_wallet_profile"
      ON public.wallet_profiles FOR UPDATE TO authenticated
      USING (
        wallet_address IN (
          SELECT wallet_address FROM public.user_wallets WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;


-- =====================================================
-- 5. wallet_audit_log
--    Old: "Anyone can insert audit logs" — anon write
--    New: authenticated users only (service role can always write)
-- =====================================================

DROP POLICY IF EXISTS "Anyone can insert audit logs"   ON public.wallet_audit_log;
DROP POLICY IF EXISTS "Service can insert audit logs"  ON public.wallet_audit_log;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_audit_log' AND policyname = 'authenticated_insert_audit_log'
  ) THEN
    CREATE POLICY "authenticated_insert_audit_log"
      ON public.wallet_audit_log FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Admins can read all audit logs; users read their own wallet logs
DROP POLICY IF EXISTS "Anyone can read audit logs"  ON public.wallet_audit_log;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_audit_log' AND policyname = 'admins_read_all_audit_logs'
  ) THEN
    CREATE POLICY "admins_read_all_audit_logs"
      ON public.wallet_audit_log FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_audit_log' AND policyname = 'users_read_own_audit_logs'
  ) THEN
    CREATE POLICY "users_read_own_audit_logs"
      ON public.wallet_audit_log FOR SELECT TO authenticated
      USING (
        wallet_address IN (
          SELECT wallet_address FROM public.user_wallets WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
