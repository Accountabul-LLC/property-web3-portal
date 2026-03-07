

## Plan: Action Items Tab + Auto-Save on Generate

### Problem
Generated action items are ephemeral — they only exist in the preview modal. If dismissed, they're lost. There's no persistent view to manage them. The user wants:
1. Tasks to auto-save to the database the moment they're generated
2. A new **"Action Items"** tab alongside AI Panel / Code Browser / Integrations showing all saved tasks

### Changes

#### 1. New component: `ActionItemsTab` (`src/components/ai-panel/ActionItemsTab.tsx`)
A full tab panel that queries `action_items` from the database and displays them in a table/list view.
- Fetches all action items for the current user, ordered by `created_at DESC`
- Displays: title, priority badge, status badge, files, GitHub link (if synced)
- Status filter buttons: All / Open / In Progress / Done
- Inline status toggle (open → in_progress → done) via dropdown or button
- Individual "Push to GitHub" button for items with `github_sync_status = 'none'`
- Delete button per item
- Empty state when no items exist

#### 2. Modify `ActionItemsPreviewModal` — auto-save on generate
- After items are parsed from the AI response, immediately insert them into the database (call `insertActionItems` right after setting `items` state)
- Remove the "Save All" button since saving is now automatic
- Keep "Push Selected to GitHub" and "Dismiss" buttons
- Show a subtle "Saved" confirmation after auto-insert

#### 3. Modify `AdminAIPanel` — add the tab
- Import `ActionItemsTab` (lazy loaded)
- Add a 4th tab trigger with `ListChecks` icon and label "Action Items"
- Add corresponding `TabsContent` rendering the new component
- Pass a `refreshKey` or similar so the tab re-fetches when items are generated from the AI Panel tab

### Files
- **Create**: `src/components/ai-panel/ActionItemsTab.tsx`
- **Modify**: `src/components/ai-panel/ActionItemsPreviewModal.tsx` — auto-save after generation
- **Modify**: `src/pages/AdminAIPanel.tsx` — add 4th tab

