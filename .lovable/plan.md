## Goal

When a user tries to swap into a token they don't yet trust, Accountabul auto-handles the trustline behind the scenes — sponsoring the XRP reserve from a dedicated treasury wallet so the user only pays gas. The sponsor wallet shows up in `/treasury` like every other treasury wallet.

## XRPL constraints (important context)

A few hard rules from the ledger that shape this design — please read before approving:

1. **A `TrustSet` must be signed by the holder account.** No XRPL transaction lets wallet A create a trustline on wallet B. Since users sign with Xaman (we don't hold their secret on mainnet), they will need to **sign one extra Xaman push** the first time they swap into a new token. There is no way around this on mainnet.
2. **The 0.2 XRP trustline reserve is locked on the holder's account, not the sponsor's.** Accountabul can't pay it directly — but we *can* send the user ~0.5 XRP from a sponsor wallet first so their account has the reserve + fee headroom to add the trustline. Net cost to the user: ≈ 0 XRP.
3. **On testnet**, the user's wallet secret is stored server-side (faucet wallets), so we can sign the `TrustSet` automatically — no second Xaman push needed there.

## Flow (mainnet)

```text
User clicks Swap → backend detects missing trustline
    │
    ├─ Sponsor wallet sends 0.5 XRP to user (server-signed, single ledger tx)
    │
    ├─ Xaman push #1: TrustSet (user signs)   ← unavoidable on mainnet
    │
    └─ Xaman push #2: Payment swap (user signs, existing flow)
```

The UI presents this as a single "Swap" action with a small inline notice: *"First time trading SOLO — we'll cover the trustline reserve. You'll see two signature requests in Xaman."*

On testnet the middle step is server-signed, so it stays a single Xaman push.

## Changes

### 1. New treasury wallet: Trustline Sponsor

- Generate a fresh XRPL wallet (mainnet + testnet).
- Add it to `xrpl_issuer_wallets` so its secret is stored server-side, encrypted, and reusable by edge functions.
- Add a row to `src/config/treasuryWallets.ts` so it appears in the `/treasury` pie chart and wallet list with label **"Trustline Sponsor Wallet"** and purpose **"User trustline subsidies"**.
- Seed it with XRP (manual one-time fund from another treasury wallet; the plan will document the address so you can fund it).

### 2. New edge function: `xrpl-sponsor-trustline`

Input: `{ wallet_address, currency, issuer, network }`

Behavior:
- Verify the caller owns `wallet_address` (same auth pattern as `xrpl-build-swap`).
- Re-check that the trustline really is missing (idempotent — if it already exists, return `{ already_trusted: true }` and do nothing).
- Load the sponsor wallet secret for the active network from `xrpl_issuer_wallets`.
- Build + sign + submit a `Payment` of 0.5 XRP from sponsor → user. Wait for validation.
- Build an unsigned `TrustSet` tx for the user's account with a sane limit (e.g. `999999999999`).
- **Testnet/devnet:** also sign + submit the `TrustSet` server-side using the user's stored faucet secret, then return `{ already_trusted: true, sponsored: true }`.
- **Mainnet:** return the unsigned `TrustSet` JSON so the client can push it through Xaman.
- Log both the funding payment and the trustline action to `wallet_audit_log` with metadata `{ kind: 'trustline_sponsor', currency, issuer, tx_hash }`.

### 3. Update `xrpl-build-swap`

Replace the hard error at line 225 with a structured response:

```json
{ "success": false, "error": "trustline_required",
  "trustline": { "currency": "534F4C4F00…", "issuer": "rsoLo…" } }
```

Status stays 400 so the existing client error handling still triggers, but the body now carries machine-readable info.

### 4. Wire it into the Swap page

In `src/pages/Swap.tsx`:

- When the build-swap call returns `error: "trustline_required"`, surface a banner under the quote area: *"You'll need a trustline for {SYMBOL}. Accountabul will cover the 0.2 XRP reserve — confirm to continue."* with a primary button **"Set up trustline & swap"**.
- Clicking it:
  1. Calls `xrpl-sponsor-trustline`.
  2. If mainnet, pushes the returned `TrustSet` to Xaman (reuse `xaman-create-payload` / `xaman-check-payload`).
  3. Once signed/validated, re-runs the existing swap quote → Xaman swap flow automatically.
- Toast progress at each step ("Funding trustline reserve…", "Confirm trustline in Xaman…", "Confirm swap in Xaman…").

### 5. Treasury surfacing

- `TREASURY_WALLETS` array gets the new sponsor entry with a `mockUsd` placeholder until live balances are wired.
- No schema change needed — the `/treasury` page already iterates `TREASURY_WALLETS` and pulls live balances from `xrpl-account-data`. The new wallet just appears.

## Open questions before I build

1. **Funding amount per sponsorship** — propose **0.5 XRP** (covers 0.2 reserve + ~0.000012 fee + buffer for a future second trustline). OK or different number?
2. **Limit value on the `TrustSet`** — propose the XRPL max (`999999999999`) so the user isn't capped. Acceptable, or do you want per-token limits?
3. **Abuse protection** — should we cap the sponsorship to *N trustlines per wallet per 24h* (e.g. 3) so a bad actor can't drain the sponsor wallet by trust-setting and un-trust-setting? I'd recommend yes, enforced via a small `trustline_sponsorships` table.
4. **Mainnet sponsor wallet** — do you want me to generate a fresh address now and you fund it after, or will you provide an existing address?