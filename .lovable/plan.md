# WalletConnect v2 + Hard KYC Chokepoint

## Goals

1. Let users connect any of the 440+ WalletConnect-compatible wallets alongside Xaman, without breaking the existing Xaman flow.
2. Refuse to sign **any** transaction (XRPL, EVM, anything) unless the signed-in user's KYC status is `approved`. Refusal happens on the server, not just the UI.
3. Keep Plan B's batched balance fetch as the unified portfolio engine — WalletConnect wallets become just more addresses fed into `xrpl-accounts-batch`.

## Critical finding from the audit

Today nothing blocks a Xaman transaction on KYC status. `SendModal`, `Swap`, `DonateModal`, `MintWizard`, and the `xaman-send-payment` edge function all sign without ever checking `kyc_cases.status`. `KycGate` only guards routes (`/tokenize`, `/mint`, `/payments/*`), not the actual signing call. This must be fixed in the same change set as WalletConnect, otherwise we'd be adding a second provider on top of a broken gate.

## Architecture

```text
                ┌────────────────────────────────────────┐
   UI button →  │  useSignTransaction(walletId, tx)      │
                │   1. ensureKycApproved()  ──► throws   │
                │   2. registry.get(provider)            │
                │   3. adapter.sign(tx)                  │
                └──────────────┬─────────────────────────┘
                               │
            ┌──────────────────┼──────────────────────┐
            ▼                  ▼                      ▼
     XamanAdapter      WalletConnectAdapter    TestnetFaucetAdapter
   (xaman-send-       (universal-provider,     (xrpl-submit-signed,
    payment edge fn)   xrpl_signTransaction)    server-side secret)
                               │
                  Every server fn (xaman-send-payment,
                  walletconnect-sign, campaign-donate,
                  xrpl-submit-signed) shares
                  _shared/require-kyc.ts → 403 if not approved.
```

The KYC chokepoint exists in **two layers**:
- Client `useSignTransaction` hook (fast UX, prevents the wallet popup from even opening).
- Shared edge-function middleware `_shared/require-kyc.ts` (the actual security boundary, can't be bypassed).

## Phase 1 — KYC chokepoint (ship first, no WC yet)

This is the foundation. Even without WC, this closes a real security hole.

**New files**
- `supabase/functions/_shared/require-kyc.ts` — calls `get_kyc_status(user.id)` RPC; throws `403 { code: 'kyc_required', status }` if not `approved`. Admins bypass via `has_role(user.id, 'admin')` to match the existing KYC admin bypass memory.
- `src/lib/signing/ensureKycApproved.ts` — client helper using `useKycStatus`'s cache; throws a typed `KycRequiredError`.
- `src/hooks/useSignTransaction.ts` — single entry point all UI uses to sign. Runs KYC check → dispatches to the right adapter by `wallet.provider`.

**Edge functions updated to call `requireKyc(userId)`**
- `xaman-send-payment`
- `campaign-donate`
- `xrpl-submit-signed` (the testnet faucet path)
- `credential-accept`
- Any future signing function (lint rule or PR checklist).

Exception: `xaman-create-payload` for **SignIn** stays open, because users need to connect a wallet *before* they can do KYC. SignIn is the only allowed pre-KYC signing operation, and the existing code already forces `TransactionType: 'SignIn'` with `submit: false`, so it's safe.

**UI updates (replace direct edge-function calls with `useSignTransaction`)**
- `SendModal.tsx:159`
- `Swap.tsx:671`, `:749`
- `DonateModal.tsx:88`
- `MintWizard.tsx:238` (Xaman branch) and `:164` (faucet branch)
- `WalletRegistrationPanel.tsx:177`

When `KycRequiredError` is thrown, the hook shows a Sonner toast and routes the user to `/kyc` (or `/kyc/status` if `submitted`/`under_review`), matching `KycGate`'s redirect logic.

## Phase 2 — WalletConnect v2 adapter

**Packages (publishable Project ID, no server secret needed)**
- `@walletconnect/universal-provider` (XRPL namespace, ~lean bundle)
- `@reown/appkit` + `@reown/appkit-adapter-wagmi` + `wagmi` + `viem` (EVM wallets, multi-chain modal UI)
- A new env var `VITE_WALLETCONNECT_PROJECT_ID` (publishable, OK in code/env).

**Reality check on XRPL support (from research)**
WalletConnect v2 has a formal `xrpl` namespace, but **Xaman, Crossmark, and GemWallet do NOT pair via WalletConnect** today. The only confirmed XRPL wallets on WC v2 are Bifrost and GirinWallet. So:
- Xaman keeps its existing direct integration (it's actually better UX than WC for Xaman users).
- WC adds: Bifrost / Girin for XRPL signing, plus 440+ EVM wallets whose addresses can be **linked for identity** but cannot sign XRPL transactions. The UI must clearly label "View-only on XRPL" for EVM-linked wallets and gate their `sign()` path with a friendly error.

**New files**
- `src/providers/wallet/types.ts` — `WalletAdapter` interface (`connect`, `disconnect`, `sign`, `canSignOn(network)`).
- `src/providers/wallet/registry.ts` — provider-string → adapter lookup.
- `src/providers/wallet/XamanAdapter.ts` — wraps current xaman-send-payment flow.
- `src/providers/wallet/WalletConnectAdapter.ts` — universal-provider, `xrpl_signTransaction` / `xrpl_signTransactionFor`; EVM adapters for non-XRPL chains throw `UnsupportedChainError` on `sign()`.
- `src/providers/wallet/TestnetFaucetAdapter.ts` — wraps current `xrpl-submit-signed`.
- `src/providers/wallet/WalletConnectProvider.tsx` — top-level provider mounted in `App.tsx`; restores existing WC sessions on load (7-day session lifetime).
- `supabase/functions/walletconnect-sign/index.ts` — only for cases where we need server-side submission of a WC-signed blob; signing itself happens client-side.

**New DB column** (single migration, no breaking change)
- `user_wallets.session_data jsonb null` — stores WC session topic for resume on reload. `xaman_user_token` stays as-is for Xaman push notifications.
- `user_wallets.provider` is already free-form `text`. Add `'walletconnect'` and `'walletconnect_evm'` as valid values (no CHECK constraint to update).

**UI**
- `WalletConnectModal.tsx:188` — replace the "More wallet options coming soon" placeholder with two buttons:
  - "Connect XRPL wallet via WalletConnect" → WC modal scoped to `xrpl:0` (and `xrpl:1` for admins).
  - "Connect EVM wallet (view-only)" → Reown AppKit modal.
- New badge in `UnifiedWalletsOverview` row: `XRPL` / `EVM (view-only)`.
- For EVM wallets, the row hides the Send button and shows "Bridge coming soon" instead.

**Plan B batch hook compatibility**
- `useXRPLPortfolioBatch` already keys on address + network and ignores provider. XRPL-side WC wallets flow through unchanged.
- EVM addresses are excluded from `xrpl-accounts-batch` calls (filter by `wallet.network === 'mainnet'|'testnet'|'devnet'`). They'll get their own balance fetch later; out of scope for this plan.

## Phase 3 — Verification

- Connect Xaman → KYC pending → try to Send → blocked with toast + redirect to `/kyc`. No Xaman popup opens.
- Admin connects Xaman → KYC ignored (admin bypass) → can send. Matches existing memory.
- Connect Bifrost via WC → approve session on phone → wallet appears in Unified Overview → balance loads via the same batch endpoint → Send works (after KYC).
- Connect MetaMask via WC → wallet appears with "EVM (view-only)" badge → Send button hidden → no edge function ever invoked.
- Hard-call `xaman-send-payment` from devtools with a non-approved user → returns `403 { code: 'kyc_required' }`. This is the security-critical assertion.
- Page reload → both Xaman and WC sessions restore without re-pairing.

## Latency expectations

- Xaman SignIn: unchanged (~3-5s including QR scan).
- WC first-pair: ~6.6s on broadband, ~7.5s on 3G (Reown's published numbers).
- WC signing on an already-paired wallet: sub-second relay + human approval time.
- Balance reads: unaffected — still 2 batched edge calls regardless of provider count.

## Out of scope (next plan)

- EVM balance aggregation (`viem` multicall) and bridging UI.
- Persistent server-side audit table for WC sessions (mirrors `xaman_payloads`).
- Migrating `credential-accept` and `campaign-donate` to the adapter pattern (Phase 1 just adds the KYC check; the adapter rewrite for those can come later).

## Files touched (summary)

**New (12):** `_shared/require-kyc.ts`, `walletconnect-sign/index.ts`, `lib/signing/ensureKycApproved.ts`, `hooks/useSignTransaction.ts`, `providers/wallet/{types,registry,XamanAdapter,WalletConnectAdapter,TestnetFaucetAdapter,WalletConnectProvider}.{ts,tsx}`, 1 migration.

**Edited (~10):** `xaman-send-payment`, `campaign-donate`, `xrpl-submit-signed`, `credential-accept`, `SendModal`, `Swap`, `DonateModal`, `MintWizard`, `WalletRegistrationPanel`, `WalletConnectModal`, `App.tsx`, `UnifiedWalletsOverview`.
