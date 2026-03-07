

## Plan: Action Items Preview Modal with Save & GitHub Push

### Current State
- "Generate Action Items" button sits inline at the bottom of the chat after a debate ends
- Items render inline with individual "Create Issue" buttons per item
- No persistence to database — items are ephemeral component state
- No bulk operations (save all, push selected)

### What Changes

#### 1. Create an `ai_action_items` database table
Store generated action items so they persist across sessions.

```sql
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

-- Users can CRUD own items
CREATE POLICY "Users can read own action items" ON public.ai_action_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own action items" ON public.ai_action_items FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own action items" ON public.ai_action_items FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own action items" ON public.ai_action_items FOR DELETE USING (user_id = auth.uid());
-- Admins can see all
CREATE POLICY "Admins can read all action items" ON public.ai_action_items FOR SELECT USING (has_role(auth.uid(), 'admin'));
```

#### 2. Create `ActionItemsPreviewModal` component
A Dialog modal that opens when "Generate Action Items" is clicked. Contains:
- Loading state while the conclude call runs
- Checkbox list of all generated items with priority badges, file tags, expected outcome
- Three action buttons at the bottom:
  - **Save All** — inserts all items into `ai_action_items` table, closes modal
  - **Push Selected to GitHub** — creates GitHub issues for checked items, saves all to DB with `github_issue_url` populated on pushed ones
  - **Dismiss** — closes modal without saving

#### 3. Refactor `ActionableConclusions` → trigger the modal
Replace the inline rendering with a button that opens the preview modal. The `generate()` logic moves into the modal. The inline component becomes just a trigger button + the modal.

#### 4. Wire into `AIPanel`
No major changes — `ActionableConclusions` still receives `topic` and `turns` props. The modal is self-contained within it.

### Files to create
- `src/components/ai-panel/ActionItemsPreviewModal.tsx` — modal with checkbox list, Save All, Push Selected, Dismiss

### Files to modify
- `src/components/ai-panel/ActionableConclusions.tsx` — move generate logic into modal, simplify to trigger + modal
- DB migration — create `ai_action_items` table

