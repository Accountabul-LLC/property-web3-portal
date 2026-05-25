
## Goal

Treat the donate dialog like "send from your wallet": show which wallet the donation will sign from, let the user swap to another connected wallet, display that wallet's spendable XRP balance, and block donations that exceed it.

## Changes (UI only, `src/components/causes/DonateModal.tsx`)

1. **Pull from `useActiveWallet`**: `wallets`, `activeWallet`, `setActiveWallet`. No new context needed.
2. **Add a wallet picker** at the top of the form step (above the asset toggle):
   - If 0 wallets → render nothing here (the upstream CTA already routes to Connect Wallet, so this case shouldn't reach the modal).
   - If 1 wallet → render a read-only row: label + truncated address.
   - If 2+ wallets → render a `Select` (shadcn) listing each wallet (label + short address). On change, call `setActiveWallet(addr)`.
3. **Fetch balance** with `useXRPLPortfolio(activeWallet?.address, campaign.network as 'mainnet' | 'testnet')`:
   - Show `Available: {spendable_xrp.toLocaleString()} XRP` under the picker, with a `Loader2` while pending.
   - Compute `maxDonatable = Math.max(0, spendable_xrp - 1)` to leave headroom for the ~1 XRP escrow object reserve + fee. Display as the hard cap for XRP.
4. **Amount validation** (XRP path only — RLUSD still shows the "coming soon" path):
   - If `amt > maxDonatable` → inline error under the input: `Not enough XRP. Available to donate: {maxDonatable} XRP (1 XRP reserved on-ledger).` and disable the Donate button.
   - If balance still loading or unknown → disable Donate.
5. **"Max" helper button** inside the amount input row that sets `amount = String(maxDonatable)` when XRP is selected and balance is loaded.
6. **Wallet mismatch guard**: if `activeWallet.network` doesn't match `campaign.network`, show a small warning under the picker: `This wallet is registered on {wallet network}. The campaign signs on {campaign network}.` (informational, does not block — the existing flow already builds the tx against the campaign's network.) Skip if `user_wallets_safe` doesn't expose `network` per wallet — in that case omit silently.

## Out of scope

- RLUSD balance / trustline check (still gated by the existing "coming soon" notice).
- Any edge function or DB changes.
- Persisting per-campaign wallet preference.

## Verify

- One wallet → modal shows that wallet + spendable balance; entering more than `spendable - 1` disables Donate with the inline error; "Max" fills the safe maximum.
- Two wallets → switching the picker updates the displayed balance and the wallet the upcoming Xaman payload signs from.
- Network matches `campaign.network` (testnet for the current campaign) so balance loads correctly.
