-- Lock down legacy public wallet tables.
-- These tables are now managed through service-role edge functions only.

-- wallet_profiles: no direct public CRUD
DROP POLICY IF EXISTS "Anyone can read wallet profiles" ON public.wallet_profiles;
DROP POLICY IF EXISTS "Anon can insert wallet profiles" ON public.wallet_profiles;
DROP POLICY IF EXISTS "Anon can update wallet profiles" ON public.wallet_profiles;

-- xaman_payloads: no direct public CRUD
DROP POLICY IF EXISTS "Anon can insert xaman payloads" ON public.xaman_payloads;
DROP POLICY IF EXISTS "Anon can select xaman payloads" ON public.xaman_payloads;
DROP POLICY IF EXISTS "Anon can update xaman payloads" ON public.xaman_payloads;

-- wallet_audit_log: service-role inserts only through edge functions
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.wallet_audit_log;
DROP POLICY IF EXISTS "Anyone can read audit logs" ON public.wallet_audit_log;
