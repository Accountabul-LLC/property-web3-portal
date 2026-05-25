-- Lock down remaining admin write surfaces so browser clients cannot mutate
-- shared admin state directly.

-- action_items and events
REVOKE INSERT, UPDATE, DELETE ON public.action_items FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.action_item_events FROM authenticated, anon;

DROP POLICY IF EXISTS "Users can insert own action items" ON public.action_items;
DROP POLICY IF EXISTS "Users can update own action items" ON public.action_items;
DROP POLICY IF EXISTS "Users can delete own action items" ON public.action_items;
DROP POLICY IF EXISTS "Admins can update all action items" ON public.action_items;
DROP POLICY IF EXISTS "Users can insert own item events" ON public.action_item_events;

-- integrations
REVOKE INSERT, UPDATE, DELETE ON public.agent_integrations FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.integration_audit_log FROM authenticated, anon;

DROP POLICY IF EXISTS "Admins can manage integrations" ON public.agent_integrations;
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.integration_audit_log;

-- issuer wallets
REVOKE INSERT, UPDATE, DELETE ON public.xrpl_issuer_wallets FROM authenticated, anon;

DROP POLICY IF EXISTS "admins_all_issuer_wallets" ON public.xrpl_issuer_wallets;

