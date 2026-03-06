
-- Agent memory table for persistent notes and learnings
CREATE TABLE public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_agent_memory_user_category ON public.agent_memory(user_id, category);
CREATE INDEX idx_agent_memory_key ON public.agent_memory(key);

-- Enable RLS
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can manage their own memory
CREATE POLICY "Users can read own agent memory"
  ON public.agent_memory FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own agent memory"
  ON public.agent_memory FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own agent memory"
  ON public.agent_memory FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own agent memory"
  ON public.agent_memory FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all memory
CREATE POLICY "Admins can read all agent memory"
  ON public.agent_memory FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
