# Plan: Admin-launched campaigns (reverse the flow)

Today campaigns are user-submitted via `/causes/apply` and then approved in `/admin/causes`. You want the inverse: **only Accountabul admins create campaigns**, and they go live on `/causes` immediately for the public to donate.

## Changes

### 1. Admin: "Launch a Campaign" form

New section at the top of `/admin/causes` with a **+ Launch Campaign** button that opens a full form (modal or inline panel) with:

- Title
- Description (rich textarea)
- Campaign image — **file upload** to a new public `campaign-images` storage bucket (we don't have one yet), with live preview. Falls back to a pasted URL.
- Recipient XRPL wallet address (with r-address validation)
- Goal amount (XRP, optional)
- Escrow release date (date picker, must be future)

On submit: insert into `campaigns` with `status='active'` directly — no review queue, no email. Campaign appears on `/causes` instantly.

### 2. Storage

Create a public `campaign-images` bucket with admin-only upload policy and public read. Uploaded images get a public URL written to `campaigns.image_url`.

### 3. Public-side removals

- Delete page `src/pages/CauseApply.tsx`
- Remove the `/causes/apply` route from `App.tsx`
- Remove all "Submit a Cause" CTAs from `src/pages/Causes.tsx` (hero button, header button, empty-state button)
- Reframe the hero copy: "Causes curated by the Accountabul civil division" instead of inviting submissions

### 4. Admin page cleanup

Since there's no longer a submission queue:

- Drop the `under_review` tab; default tab becomes **Active**
- Keep tabs: Active, Completed, Rejected (rejected = paused/hidden), All
- Keep the existing release-escrow button on each active card
- Add **Edit** and **Pause/Unpause** actions per campaign (status toggle between `active` ↔ `rejected`)

### 5. Seed a starter campaign

Insert one live campaign so you can immediately see the flow:

- **Title:** Donate to Accountabul
- **Description:** Support platform development and the civil division's work.
- **Recipient:** `rHsehLToQL7puJCkmk2dne53iXX2K6LffW` (your testnet wallet)
- **Goal:** 1000 XRP, **Release:** ~30 days out, **Status:** active

### 6. Secret (still needed for escrow release)

Once any donation comes in, the `**campaign-release**` edge function needs `**CAMPAIGN_RELEASE_SIGNER_SEED**` to broadcast the `EscrowFinish`. We'll prompt for it as part of build. This is independent from the recipient — it only pays the ~12 drop fee.

## Out of scope

- Editing donations or refunds
- Multi-image galleries (single image per campaign for now) - add this 
- Public submission form (removed; can be reintroduced later behind a separate "Suggest a cause" contact form if you want) - can keep or say coming soon

## Files touched

- `src/pages/AdminCauses.tsx` — new launch form, tab changes, edit/pause actions
- `src/pages/Causes.tsx` — remove submit CTAs, update copy
- `src/App.tsx` — drop `/causes/apply` route
- `src/pages/CauseApply.tsx` — **deleted**
- New migration: `campaign-images` bucket + RLS
- One data insert: seed "Donate to Accountabul" campaign
- Secret prompt: `CAMPAIGN_RELEASE_SIGNER_SEED`