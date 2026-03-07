
CREATE TABLE public.ai_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.ai_debate_sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  files text[] DEFAULT '{}',
  expected_outcome text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  github_issue_url text,
  github_issue_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own action items" ON public.ai_action_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own action items" ON public.ai_action_items FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own action items" ON public.ai_action_items FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own action items" ON public.ai_action_items FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admins can read all action items" ON public.ai_action_items FOR SELECT USING (has_role(auth.uid(), 'admin'));
