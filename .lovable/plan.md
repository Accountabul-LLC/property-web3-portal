## Goal
Give admins the ability to take a campaign down from the public-facing Causes page without deleting it, and bring it back later.

## Approach
Add a `visibility` column to the `campaigns` table (`'public' | 'hidden'`, default `'public'`). Keep `status` semantics intact — visibility is a separate axis so a campaign can be `active` but hidden, or `under_review` (already invisible) without conflict.

Public read policy gates on `visibility = 'public'` in addition to status. Admin reads continue to see everything.

## Database changes
- `ALTER TABLE campaigns ADD COLUMN visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','hidden'))`
- Add columns `hidden_at timestamptz`, `hidden_reason text`, `hidden_by uuid` for audit.
- Replace `public_read_active_campaigns` policy to also require `visibility = 'public'`.
- Same gating for `get_public_campaign_donations` consumers is already scoped by `campaign_id`, no change needed.

## Edge function (`campaign-admin`)
Add a new action `set_visibility`:
- Body: `{ action: 'set_visibility', campaign_id, visibility: 'public' | 'hidden', reason?: string }`
- Admin-only (existing guard).
- Updates `visibility`, `hidden_at` (now or null), `hidden_reason`, `hidden_by`.
- Logs to audit table the same way other actions do.

## Frontend — `src/pages/AdminCauses.tsx`
- Extend the `Campaign` type with `visibility`, `hidden_at`, `hidden_reason`.
- Card header row: when `visibility === 'hidden'`, show a small "Hidden" pill next to the status badge so it's instantly recognizable.
- Add a new quick-action button on each card:
  - If `visibility === 'public'`: "Hide" button (EyeOff icon) → opens a small inline confirm with an optional reason textarea, then calls `set_visibility: 'hidden'`.
  - If `visibility === 'hidden'`: "Show" button (Eye icon) → calls `set_visibility: 'public'` (no reason needed).
- Expanded section shows `hidden_reason` and `hidden_at` when present.
- Optional small filter chip in the tabs row: "Hidden" count, so admins can quickly find taken-down items.

## Public side
No code change needed — the RLS policy already filters them out. Already-active-but-hidden campaigns will simply stop appearing on `/causes` and direct `/causes/:slug` URLs return not-found (since the same select goes through RLS).

## Out of scope
- No new soft-delete or archive state.
- No notification to the cause submitter (can add later).
- No bulk hide/show.

## Files touched
- `supabase/migrations/<new>.sql` — schema + policy.
- `supabase/functions/campaign-admin/index.ts` — new action.
- `src/pages/AdminCauses.tsx` — UI controls, badge, filter.