## Goal
Decouple "save property" (heart) from wallet connection. A signed-in user should be able to save/unsave any property regardless of whether they have a wallet connected. Only signed-out visitors get an auth prompt.

## Current behavior (why it breaks)
`saved_properties` is keyed on `wallet_address`, with RLS using `owns_wallet(wallet_address)`. The hook (`useSavedProperties.ts`) and the button (`PropertySaveButton.tsx`) both require an active wallet, so a signed-in user with no wallet sees "Connect your wallet."

## Plan

### 1. Schema: tie saves to the user, not the wallet (migration)
- `ALTER TABLE public.saved_properties ADD COLUMN user_id uuid;`
- Backfill: `UPDATE saved_properties sp SET user_id = uw.user_id FROM public.user_wallets uw WHERE uw.wallet_address = sp.wallet_address AND uw.status = 'active' AND sp.user_id IS NULL;`
- Drop orphan rows where backfill fails (no matching active wallet) so we can `SET NOT NULL` cleanly.
- `ALTER COLUMN user_id SET NOT NULL`.
- `wallet_address` becomes nullable (kept for historical context, not used in policies).
- Add `UNIQUE (user_id, property_id)` so a user can't double-save.
- Replace RLS policies:
  - `SELECT`: `user_id = auth.uid()`
  - `INSERT`: `WITH CHECK (user_id = auth.uid())`
  - `DELETE`: `user_id = auth.uid()`
  - (No UPDATE needed.)
- Replace `public.get_saved_properties_for_wallet(text)` with `public.get_saved_properties_for_user()` that reads `auth.uid()` directly. Re-grant EXECUTE to `authenticated` + `service_role`, revoke from PUBLIC. (Drop the old function.)
- Keep the existing GRANTs on the table for `authenticated` + `service_role`.

### 2. Hook: `src/hooks/useSavedProperties.ts`
- Drop `useActiveWallet` dependency.
- Query key becomes `['saved-properties', user.id]`; `enabled: !!user`.
- `useSavedProperties` calls the new `get_saved_properties_for_user` RPC.
- `useToggleSavedProperty`:
  - Only require `user`. Remove the wallet-connected error path.
  - Filter existing/insert/delete by `user_id = user.id` (and `property_id`). Insert sets `user_id`.
- Optimistic update keyed on user id.
- Toast wording: drop the "Connect a wallet…" branch.

### 3. Button: `src/components/property/PropertySaveButton.tsx`
- Remove the `if (!activeAddress) openConnectModal()` branch.
- Behavior:
  - Not signed in → `navigate('/auth')` (unchanged).
  - Signed in → call `saveToggle.mutateAsync(propertyId)` directly.
- Drop the `useActiveWallet` import.

### 4. Type drift
`src/integrations/supabase/types.ts` is auto-regenerated after the migration, so the new `user_id` column and the new RPC name will appear on their own. The hook uses `as any` casts already, so it keeps compiling in the interim.

## Out of scope
- No changes to the wallet connect flow or any other wallet-gated feature (trading, donating, minting) — those still require a wallet for valid blockchain reasons.
- No UI changes to where the heart button is displayed.
- No migration of historical saves whose owning user can't be inferred (those rows get dropped during backfill; this is a soft-state feature, acceptable loss).

## Result
- Signed-in users can heart any property whether or not they have a wallet connected.
- Anonymous visitors are still routed to `/auth` when they click the heart.
- Saved-properties list on the dashboard works for any signed-in user, wallet or not.
