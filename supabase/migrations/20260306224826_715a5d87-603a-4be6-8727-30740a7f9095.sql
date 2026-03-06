
CREATE TABLE public.agent_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  integration_type text NOT NULL DEFAULT 'github',
  enabled boolean NOT NULL DEFAULT false,
  config jsonb DEFAULT '{}'::jsonb,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, integration_type)
);

CREATE TABLE public.integration_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid,
  integration_type text NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.agent_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage integrations" ON public.agent_integrations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read audit log" ON public.integration_audit_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit log" ON public.integration_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));
