# Plan: Finish admin-launched Causes flow

## Step 1 — Generate testnet seed (build mode)
Run `curl -X POST https://faucet.altnet.rippletest.net/accounts` and capture `{ account: { address, secret } }`. Show you the **secret** (starts with `s...`) to paste into the secret form.

## Step 2 — Add `CAMPAIGN_RELEASE_SIGNER_SEED` secret
Prompt you via the secret tool. You paste the seed from Step 1. Used by the `campaign-release` edge function to sign `EscrowFinish` (pays ~12 drop fee only).

## Step 3 — Frontend refactor (admin-launched flow)
- **`src/pages/AdminCauses.tsx`**: Add "+ Launch Campaign" dialog with fields: title, description, image upload (→ `campaign-images` bucket), recipient r-address (validated), goal XRP, release date. On submit insert into `campaigns` with `status='active'`. Drop `under_review` tab; default to **Active**. Add **Edit** and **Pause/Unpause** (active ↔ rejected) row actions. Keep release-escrow button.
- **`src/pages/Causes.tsx`**: Remove all "Submit a Cause" CTAs; reframe hero copy to "Causes curated by the Accountabul civil division."
- **`src/pages/CauseApply.tsx`**: Delete.
- **`src/App.tsx`**: Remove `/causes/apply` route + import.

## Step 4 — Edge function tweak
`supabase/functions/campaign-release/index.ts`: read `CAMPAIGN_RELEASE_SIGNER_SEED`; clear error if missing.

## Step 5 — Verify
Reload `/admin/causes`, launch a test campaign with an image, confirm it appears on `/causes`, confirm `/causes/apply` 404s.

## Out of scope
Donation/refund editing, multi-image galleries, reintroducing public submission form.
