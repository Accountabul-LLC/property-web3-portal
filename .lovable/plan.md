

## Plan: Code Browser + Integrations Dashboard in Admin AI Panel

This plan adds three capabilities to the Admin AI Panel:

### 1. GitHub Code Browser Tab
A new tab within the Admin AI Panel page that calls the existing `github-agent` edge function to browse files from `Jibreelm/property-web3-portal`.

- **File tree panel**: Calls `get_tree` on load, displays a collapsible folder/file tree in a left sidebar
- **File viewer panel**: When a file is clicked, calls `get_file` and renders the content in a scrollable `<pre><code>` block with the file path as a header
- **Component**: `src/components/admin/CodeBrowser.tsx` — contains tree + viewer using `ResizablePanelGroup`
- **Hook**: `src/hooks/useGitHubAgent.ts` — wraps `supabase.functions.invoke('github-agent', ...)` for `get_tree` and `get_file` actions

### 2. Integrations Dashboard Tab
A new tab showing connected integrations with audit trail and on/off toggles per agent.

- **New DB table**: `agent_integrations` — stores which agents have which integrations enabled
  - Columns: `id`, `agent_id` (uuid, references ai_agents), `integration_type` (text, e.g. 'github'), `enabled` (boolean), `config` (jsonb), `connected_at`, `updated_at`
  - RLS: admin-only read/write via `has_role`
- **New DB table**: `integration_audit_log` — records every toggle/connect/disconnect event
  - Columns: `id`, `agent_id`, `integration_type`, `action` (text: 'enabled'|'disabled'|'connected'|'disconnected'), `actor_id` (uuid), `created_at`, `metadata` (jsonb)
  - RLS: admin-only read, insert via `has_role`
- **Component**: `src/components/admin/IntegrationsDashboard.tsx`
  - Shows a card per integration (GitHub is the first) with connection status badge and timestamp
  - Per-agent toggle switches: lists all agents from `ai_agents` table with a Switch to enable/disable GitHub access
  - Audit log section: chronological list of toggle events from `integration_audit_log`

### 3. Updated Admin AI Panel Page
Refactor `AdminAIPanel.tsx` to use top-level `Tabs` with three tabs:
- **AI Panel** (existing debate UI + session sidebar)
- **Code Browser** (new)
- **Integrations** (new)

### File Changes Summary

| File | Action |
|------|--------|
| `src/hooks/useGitHubAgent.ts` | Create — helper hook for github-agent edge function |
| `src/components/admin/CodeBrowser.tsx` | Create — tree + file viewer |
| `src/components/admin/IntegrationsDashboard.tsx` | Create — integration cards, agent toggles, audit log |
| `src/pages/AdminAIPanel.tsx` | Edit — add Tabs wrapper with 3 tabs |
| DB migration | Create `agent_integrations` + `integration_audit_log` tables with RLS |

### Technical Details

**Code Browser data flow:**
```text
CodeBrowser → useGitHubAgent.getTree() → supabase.functions.invoke('github-agent', { action: 'get_tree', owner, repo })
           → useGitHubAgent.getFile(path) → supabase.functions.invoke('github-agent', { action: 'get_file', owner, repo, path })
```

**Integration toggle flow:**
```text
Toggle Switch → upsert agent_integrations (agent_id, 'github', enabled)
             → insert integration_audit_log (agent_id, 'github', 'enabled'/'disabled', actor_id)
```

**DB Migration SQL (schema):**
```sql
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

-- RLS: admin-only for both tables
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
```

