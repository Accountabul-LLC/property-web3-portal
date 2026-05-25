# Accepted-assets whitelist for campaigns

Restrict which assets the platform's donate flow will accept per campaign. Defaults stay safe; donors can never push an unapproved asset through our flow. On-chain hardening of recipient wallets is explicitly out of scope.

## Scope

- Asset whitelist limited to `XRP` and `RLUSD` (platform-supported set).
- We will eventually set this up to where we have issuing wallets and all of the tokens that we launch from that issuing wallet is going to be on this hard coded list as well we can set that up too so if you see our two wallets we've already connected to the test net and launched multiple different tokens that represent 100% ownership rights of a property So that's specifically what we are looking to make sure that we can escrow because some people may have real estate or something that they want to donate you can donate fractional shares of real estate also if that's not the case if a user has only real estate to donate and they want to sell the real estate for fiat or for you know a stable coin we need to be able to facilitate that payment or that transaction So they sell the real estate on our platform we need to get a small fee from that and then we also need to cash them out Then after they get cashed out that cash needs to go into the donation pot because that was their intention in the first place was to swap out the asset for Fiat and then automatically donate whatever they were swapping what amount they were swapping into that donation pool
- Submitter picks accepted assets on the public submit form; admin can override in the edit drawer; donate modal only shows allowed options.
- Wire RLUSD as a real IOU payment path in `campaign-donate` (trustline-gated; bounces with a clear message if the donor has no RLUSD trustline / balance).

## Out of scope

- Recipient wallet on-chain protections (`DisallowIncomingTrustline`, `DepositAuth`, etc.).
- Any other token types (MPT, arbitrary IOUs).
- Bulk migration UI — existing campaigns just default to `['XRP']`.

## Database

Migration on `campaigns`:

- Add `accepted_assets text[] NOT NULL DEFAULT ARRAY['XRP']`.
- CHECK: every element must be in `('XRP','RLUSD')` and array length ≥ 1.
- Backfill existing rows to `['XRP']` (default handles it).

## Edge functions

`**campaign-submit**`

- Accept optional `accepted_assets` in body; validate it's a non-empty subset of `['XRP','RLUSD']`; default to `['XRP']` if omitted.
- Persist on insert.

`**campaign-admin` (`update_campaign` action)**

- Allow `accepted_assets` in update payload; same validation; include in audit `beforeState`/`afterState`.

`**campaign-donate**`

- After loading campaign, read `accepted_assets`; reject the request if `currency` from body is not in the list (`400` with clear message).
- Add RLUSD branch:
  - Hardcoded RLUSD issuers per network (mainnet: `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`; testnet: `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`) — confirmed standard addresses; expose via small `RLUSD_ISSUER[network]` const.
  - Build `Payment` tx with `Amount: { currency: '524C555344000000000000000000000000000000', issuer, value }` (40-hex RLUSD code).
  - Preflight: confirm recipient has a trustline to the issuer; if not, return a friendly error ("Recipient hasn't set up an RLUSD trustline yet — ask them to add one or donate in XRP").
  - Donor preflight: confirm donor has trustline + sufficient balance (account_lines).
  - Skip the XRP-drops reserve math for the IOU path.
  - Same Xaman flow; `custom_meta.blob.purpose` becomes `CAMPAIGN_DONATION_DIRECT_RLUSD` / `…_ESCROW_RLUSD`.
  - Note: XRPL `EscrowCreate` only supports XRP — if campaign is scheduled (not evergreen) and asset is RLUSD, reject with "RLUSD donations are only available for direct (evergreen) campaigns." Surface the same constraint in the UI so the option is hidden when incompatible.

## Frontend

`**src/pages/CauseApply.tsx` (public submit form)**

- New field: `accepted_assets` — checkbox group (XRP, RLUSD), XRP checked + disabled (always on), RLUSD optional.
- Helper text: "Choose what assets this cause will accept. Donors using any other token would need to be handled off-platform."
- Submit body includes `accepted_assets`.

`**src/pages/AdminCauses.tsx` (edit drawer)**

- Add `accepted_assets: string[]` to `EditFormShape`, load/restore in `openEdit` and `discardEditDraft`.
- Render the same checkbox group inside the existing edit form (above the visibility toggle).
- `handleSaveEdit` passes `accepted_assets` through to `campaign-admin` update.
- Tiny inline badge on each cause card showing accepted assets (e.g. "XRP · RLUSD").

`**src/components/causes/DonateModal.tsx**`

- Read `campaign.accepted_assets`; render only those buttons in the asset toggle (if only one, render a read-only chip).
- Remove the hardcoded "RLUSD coming soon" notice when RLUSD is in the whitelist.
- If the campaign is `scheduled` mode and donor picks RLUSD, show inline note + disable Donate (matches edge-function guard).
- Pass `currency` through to `campaign-donate` (already happens).

`**src/hooks/useCampaigns.ts` + `Campaign` type**

- Add `accepted_assets: string[]` to the type so frontend reads it without `any` casts.

## Files touched

- `supabase/migrations/<new>.sql`
- `supabase/functions/campaign-submit/index.ts`
- `supabase/functions/campaign-admin/index.ts`
- `supabase/functions/campaign-donate/index.ts`
- `src/pages/CauseApply.tsx`
- `src/pages/AdminCauses.tsx`
- `src/components/causes/DonateModal.tsx`
- `src/hooks/useCampaigns.ts`

## Validation

- New campaign defaults to XRP-only; donate works as today.
- Campaign with `['XRP','RLUSD']`: donor sees both, can donate either (direct campaigns only for RLUSD).
- Sending `currency: 'SHITCOIN'` directly to the edge function returns 400.
- Existing rows: no behavior change.