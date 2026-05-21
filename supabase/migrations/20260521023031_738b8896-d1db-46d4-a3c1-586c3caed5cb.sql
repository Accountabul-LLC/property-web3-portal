
-- Remove overly permissive RLS policies on tables written to by edge functions.
-- Edge functions use service_role which bypasses RLS, so open policies are unnecessary and dangerous.

-- xaman_payloads: anyone could read/update/insert QR payload data
DROP POLICY IF EXISTS "Anon can insert xaman payloads" ON public.xaman_payloads;
DROP POLICY IF EXISTS "Anon can select xaman payloads" ON public.xaman_payloads;
DROP POLICY IF EXISTS "Anon can update xaman payloads" ON public.xaman_payloads;

-- wallet_credentials: anyone could insert/update credential records
DROP POLICY IF EXISTS "Service can insert credentials" ON public.wallet_credentials;
DROP POLICY IF EXISTS "Service can update credentials" ON public.wallet_credentials;

-- wallet_profiles: redundant table, anyone could read/update/insert
DROP POLICY IF EXISTS "Anon can insert wallet profiles" ON public.wallet_profiles;
DROP POLICY IF EXISTS "Anon can update wallet profiles" ON public.wallet_profiles;
DROP POLICY IF EXISTS "Anyone can read wallet profiles" ON public.wallet_profiles;

-- credential_applications: anyone could update application status
DROP POLICY IF EXISTS "Service can update applications" ON public.credential_applications;

-- trustline_sponsorships: anyone could insert/update sponsorship records
DROP POLICY IF EXISTS "Service can insert sponsorships" ON public.trustline_sponsorships;
DROP POLICY IF EXISTS "Service can update sponsorships" ON public.trustline_sponsorships;
