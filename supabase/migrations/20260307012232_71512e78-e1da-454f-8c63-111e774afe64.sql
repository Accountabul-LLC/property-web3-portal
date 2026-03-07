
ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS github_repo text,
  ADD COLUMN IF NOT EXISTS pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS github_labels text[] DEFAULT '{}';
