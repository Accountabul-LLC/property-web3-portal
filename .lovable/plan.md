
## Goal

Stop fronting Xaman as the brand on the donate flow. The user connects **their wallet** to donate; Xaman is just one of the wallet options behind the scenes. If they're already signed in with an active wallet, skip straight to the amount entry. Allow donating in **XRP or RLUSD**.

## Changes

### 1. `src/pages/CauseDetail.tsx` — donate CTA logic

Replace the current single button block with three states:

- **Not signed in** → button: `Sign In to Donate` → `/auth` (unchanged behavior, relabeled).
- **Signed in, no active wallet** → button: `Connect Wallet to Donate` → opens existing `WalletConnectModal`.
- **Signed in + active wallet** → button: `Donate` → opens `DonateModal` (no "with Xaman" wording).

Pull active wallet from `ActiveWalletContext` (already used elsewhere). Remove the Xaman icon/text from the CTA — use `Heart` only.

### 2. `src/components/causes/DonateModal.tsx` — amount UX + asset picker

- Title: `Donate to {campaign.title}` (drop the Xaman heart framing — keep `Heart` icon, that's fine).
- Add an **asset toggle** above the amount field: `XRP` / `RLUSD` (segmented control using existing `Tabs` or two `Button` toggles, themed via design tokens).
- State: `asset: 'XRP' | 'RLUSD'`, default `XRP`.
- Min validation: 1 XRP for XRP, 1 RLUSD for RLUSD (tighten later if needed).
- Escrow explainer copy: replace "XRPL escrow" sentence to drop the Xaman name — say "locked on the XRP Ledger" and mention signing happens in your connected wallet.
- Submit button: `Donate` (with spinner state `Preparing…`). Remove "with Xaman" wording. Keep `Heart` icon.
- QR step: keep the QR (still Xaman under the hood) but reframe copy to "Scan with your wallet app to sign" and keep the small "Open in Xaman app" deep-link as a secondary affordance — that's accurate disclosure, not branding.

### 3. Donation request — pass currency

- `DonateModal.handleSubmit` sends `{ campaign_id, amount, currency: asset, donor_message, is_anonymous }` to `campaign-donate`.
- This plan does **not** change the edge function or DB schema. RLUSD wiring on the backend (issuer address, EscrowCreate with IOU amount) is **out of scope** for this turn — we'll surface a clear inline notice if `RLUSD` is selected: "RLUSD donations coming soon — switch to XRP to donate now." and disable the submit button when RLUSD is selected. This unblocks the UX reframe without shipping a half-working backend path.

  Alternative: if you want RLUSD to actually go through now, that's a separate follow-up to update `campaign-donate/index.ts` to build an IOU EscrowCreate against the official RLUSD issuer per network, plus a trustline check. Say the word and I'll add it as a second step after this UI change.

### 4. Out of scope

- Backend RLUSD escrow path (above).
- Wallet connection refactor — reuse existing `WalletConnectModal` + `ActiveWalletContext` as-is.
- No DB/migration changes.

## Verify

- Logged out → button reads `Sign In to Donate`.
- Logged in, no wallet → button reads `Connect Wallet to Donate`, opens wallet modal.
- Logged in + wallet → button reads `Donate`, opens donate modal with XRP/RLUSD toggle; XRP path works end-to-end; RLUSD shows "coming soon" inline.
