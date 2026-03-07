
-- Drop the lightweight table we just created
DROP TABLE IF EXISTS public.ai_action_items;

-- Full action_items table
CREATE TABLE public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_thread_id uuid REFERENCES public.ai_debate_sessions(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'debate',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'MEDIUM',
  status text NOT NULL DEFAULT 'open',
  files_json jsonb DEFAULT '[]',
  expected_outcome text DEFAULT '',
  acceptance_criteria text DEFAULT '',
  created_by uuid NOT NULL,
  assigned_to uuid,
  github_issue_number integer,
  github_issue_url text,
  github_sync_status text DEFAULT 'none',
  completion_signal text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own action items" ON public.action_items FOR SELECT USING (created_by = auth.uid());
CREATE POLICY "Users can insert own action items" ON public.action_items FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own action items" ON public.action_items FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Users can delete own action items" ON public.action_items FOR DELETE USING (created_by = auth.uid());
CREATE POLICY "Admins can read all action items" ON public.action_items FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all action items" ON public.action_items FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Lifecycle events table
CREATE TABLE public.action_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_item_id uuid NOT NULL REFERENCES public.action_items(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_item_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own item events" ON public.action_item_events FOR SELECT
  USING (action_item_id IN (SELECT id FROM public.action_items WHERE created_by = auth.uid()));
CREATE POLICY "Users can insert own item events" ON public.action_item_events FOR INSERT
  WITH CHECK (action_item_id IN (SELECT id FROM public.action_items WHERE created_by = auth.uid()));
CREATE POLICY "Admins can read all item events" ON public.action_item_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
