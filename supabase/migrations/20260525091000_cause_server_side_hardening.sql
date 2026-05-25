-- Server-side hardening for the Causes workflow.
-- Moves campaign submission/admin mutations behind edge functions and
-- centralizes audit logging for campaign lifecycle actions.

-- ------------------------------------------------------------
-- app_audit_log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area         TEXT NOT NULL,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  actor_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state  JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_audit_log_created_at_idx
  ON public.app_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS app_audit_log_area_idx
  ON public.app_audit_log (area, created_at DESC);
CREATE INDEX IF NOT EXISTS app_audit_log_entity_idx
  ON public.app_audit_log (entity_type, entity_id, created_at DESC);

ALTER TABLE public.app_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.app_audit_log FROM authenticated, anon;

DROP POLICY IF EXISTS "admins_read_app_audit_log" ON public.app_audit_log;
CREATE POLICY "admins_read_app_audit_log"
  ON public.app_audit_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_officer')
  );

-- ------------------------------------------------------------
-- campaigns
-- ------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.campaigns FROM authenticated, anon;

DROP POLICY IF EXISTS "authenticated_submit_campaign" ON public.campaigns;
DROP POLICY IF EXISTS "admins_update_campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "admins_delete_campaigns" ON public.campaigns;

-- ------------------------------------------------------------
-- campaign_donations
-- ------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.campaign_donations FROM authenticated, anon;

DROP POLICY IF EXISTS "authenticated_insert_donation" ON public.campaign_donations;
