## Goal

Replace the "Also accept RLUSD donations" checkbox on `/causes/apply` with a dynamic asset picker driven by the submitter's connected wallet holdings. Auto-switch the campaign to direct (evergreen) mode when a non-XRP asset is selected, since XRPL native escrow is XRP-only.

## UX flow

1. **No wallet connected** → show inline notice: "Connect your Xaman wallet to choose accepted assets" with a Connect button. Recipient address field stays free-input; campaign defaults to XRP-only scheduled.
2. **Wallet connected** → fetch holdings via existing `useXRPLPortfolio(activeWallet, activeNetwork)`. Render an asset checklist:
  - **XRP** — always shown, default checked, can't be unchecked.
  - **RLUSD** — shown only if the wallet has an RLUSD trustline (detected by currency hex `524C555344...` against the network's official issuer). Tooltip if missing: "No RLUSD trustline detected on this wallet."
  - Other tokens/MPTs in the wallet are listed but disabled with a "Not supported by donation flow yet" hint, so the user sees them but can't pick them.
3. **Recipient address field** auto-fills with the connected wallet address (editable). If user edits it to a different address, show a small warning: "Accepted assets are based on your connected wallet's trustlines, not the recipient's. Make sure the recipient also has the required trustlines."
4. **Mode auto-switch**: if RLUSD is checked, the form silently sets `campaign_mode = 'direct'` and hides/clears the release date field (replaced with note: "Direct mode — donations forward immediately. Required because non-XRP assets can't be escrowed on XRPL."). If user unchecks RLUSD, mode reverts to `scheduled` and release date re-appears.
  &nbsp;

## Form & submission changes

- Remove `accept_rlusd` boolean from zod schema; add `accepted_assets: z.array(z.enum(['XRP','RLUSD'])).min(1).default(['XRP'])` and `campaign_mode: z.enum(['scheduled','direct']).default('scheduled')`.
- `release_date` becomes conditional: required when `campaign_mode === 'scheduled'`, optional/null when `'direct'`.
- Pass `accepted_assets` and `campaign_mode` to `campaign-submit` edge function. (`campaign-submit` already accepts `accepted_assets`; needs a small addition for `campaign_mode` — verify and extend if not present.)

## Files to touch

- `src/pages/CauseApply.tsx` — schema, form fields, asset picker component, mode auto-switch logic, recipient default + warning.
- New: `src/components/causes/AcceptedAssetsPicker.tsx` — encapsulates the wallet-holdings-driven checklist (reusable for the admin edit drawer later).
- `supabase/functions/campaign-submit/index.ts` — accept and persist `campaign_mode` (and clear `release_date` for direct mode). Confirm validation already enforces RLUSD ⇒ direct.

## Out of scope

- No changes to admin edit drawer in this pass (still uses the simple RLUSD toggle there).
- No new MPT/IOU donation support.
- No on-chain trustline check for the recipient address — surfaced as a warning only.