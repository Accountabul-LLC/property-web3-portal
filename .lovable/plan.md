## Problem

Your new campaign ("test donation") was saved with `status = 'approved'`, but the public Causes page only lists campaigns with `status IN ('active', 'completed')` (both in the `useCampaigns` hook and the `public_read_active_campaigns` RLS policy). So the campaign exists but is invisible to the public.

The existing "Approve" button on an under-review row already correctly sets status to `'active'` (AdminCauses.tsx line 128). The bug is only in the **Create Campaign** dialog — its status dropdown offers `'approved'` as an option, and the insert writes that value as-is.

## Fix

In `src/pages/AdminCauses.tsx` — Create Campaign flow:

1. Remove the `'approved'` option from the create form's status select (keep `under_review`, `active`, `completed`, `rejected`). `approved` is a transient state we don't expose anywhere else.
2. As a safety net in the insert handler, normalize `'approved' → 'active'` before writing.

No DB migration, no RLS change, no edge function change.

## Backfill existing record

One-line update for the already-created campaign:
```sql
UPDATE campaigns SET status = 'active' WHERE id = 'bc297e1a-3e97-421f-830c-917504954dd7';
```

## End-to-end test

1. Reload `/causes` → confirm "test donation" now shows in the grid.
2. Open the cause detail page → confirm donate button works.
3. In Admin → Causes → "Add Campaign", create a second test cause with status = Active → confirm it appears immediately on `/causes` (after the `['campaigns']` query refetches).
4. Create one with status = Under Review → confirm it does NOT appear publicly, but shows in the admin "Under Review" tab.
