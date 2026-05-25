## Follow-ups from the asset-picker work

The submitter form (`/causes/apply`) is done — wallet-driven picker, auto direct mode, recipient defaulted to connected wallet. A few loose ends remain from the previous turn:

### 1. Mirror the picker in admin edit drawer
`src/pages/AdminCauses.tsx` still uses the old simple "Accept RLUSD" toggle in the Edit Cause drawer. Replace it with `<AcceptedAssetsPicker>` so admins get the same wallet-aware UX (driven by the admin's own connected wallet, since they're the ones reviewing). Saving still goes through `campaign-admin` which already accepts `accepted_assets`.

### 2. Admin cause cards — accepted-assets badge
On the admin Causes list cards, add a small badge row showing the campaign's accepted assets (e.g. `XRP` or `XRP · RLUSD`) so reviewers can see at a glance what each campaign takes without opening the drawer.

### 3. `campaign-donate` cleanup
Earlier work left some unused `xrpAmount` / `drops` variable references in the response payload of `supabase/functions/campaign-donate/index.ts` after the RLUSD branch was added. Small dead-code/typing pass — no behavior change.

### Files touched
- `src/pages/AdminCauses.tsx` (picker swap + card badge)
- `supabase/functions/campaign-donate/index.ts` (cleanup only)

### Out of scope
- No new on-chain features, no MPT/IOU donate support, no schema changes.