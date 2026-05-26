-- Restore frontend access to membership tiers after the security pass.
-- RLS still controls which rows each role can see or mutate.

GRANT SELECT ON public.membership_tiers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.membership_tiers TO authenticated;
GRANT SELECT ON public.membership_tiers TO service_role;
