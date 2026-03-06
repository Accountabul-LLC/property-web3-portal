# Authentication System — Property Web3 Portal (RWA)

> **Status**: V1 prototype reference
> **Last Updated**: 2026-03-06

---

## Overview

The app has **two independent auth layers** that coexist. Both must be understood to reason about any feature that touches user identity or wallet access.

---

## Layer 1: Supabase Auth (Email + Google)

**What it does**: Manages user account identity. Provides a JWT session stored in the browser.

**Methods supported**:
- Email + password
- Google OAuth (auto-populates `profiles` table via DB trigger on `auth.users`)

**Key files**:
- `pages/Auth.tsx` — sign in / sign up / Google button
- `pages/ResetPassword.tsx` — password reset flow
- `hooks/useAuth.ts` — `{ user, loading, signOut }`
- `integrations/supabase/client.ts` — Supabase client singleton

**Session storage**: Supabase manages the session internally using browser storage. `supabase.auth.getSession()` returns the current session.

**DB tables involved**:
- `auth.users` — Supabase-managed, stores identity
- `profiles` — Extended user data (first name, last name, avatar, phone). Populated by a DB trigger on `auth.users` insert. Updated by `useProfile` hook.

**When is it required?**
- Accessing `/dashboard`, `/tokenize`, `/mint`
- Adding or managing wallets (wallet operations require `user_id` FK)
- Submitting tokenization forms

---

## Layer 2: Xaman Wallet Auth (XRPL)

**What it does**: Proves ownership of an XRPL wallet address. Does NOT create a Supabase Auth session.

**Flow**:
1. User clicks "Connect Wallet"
2. `xaman-create-payload` edge function creates a `SignIn` payload on Xaman's API
3. QR code displayed in `WalletConnectModal`
4. User scans with Xaman mobile app and signs the request cryptographically
5. `xaman-check-payload` polls every 2 seconds until:
   - `signed: true` → extracts `response.account` (XRPL r-address)
   - `cancelled` or `expired` → error state
6. On success: wallet address is upserted into `user_wallets` (with the current Supabase `user_id`)
7. `ActiveWalletContext` updates local state, stores active address in localStorage

**Key files**:
- `components/WalletConnectModal.tsx` — QR display + polling UI
- `contexts/ActiveWalletContext.tsx` — wallet state management
- `supabase/functions/xaman-create-payload/index.ts`
- `supabase/functions/xaman-check-payload/index.ts`

**DB tables involved**:
- `xaman_payloads` — tracks payload lifecycle (pending → signed/cancelled/expired)
- `user_wallets` — links wallet address to `user_id`, stores label, network, provider
- `wallet_audit_log` — immutable event log for all wallet lifecycle actions

---

## How the Two Layers Interact

```
Supabase Auth User (auth.users.id = UUID)
         │
         │ FK: user_id
         ▼
  user_wallets (wallet_address, user_id, network, provider, ...)
         │
         │ activeAddress stored in localStorage
         ▼
  ActiveWalletContext (wallets[], activeAddress)
```

**Rules**:
1. A user must be signed in via Supabase Auth to **add** a wallet
2. Once a wallet is connected, the wallet address is used for all XRPL operations
3. Supabase Auth session and wallet state are cleared together on sign-out
4. The 30-minute inactivity timeout clears both the Supabase session (`supabase.auth.signOut()`) and the wallet context state

**There is no cryptographic proof that a Supabase Auth user "owns" an XRPL address** — Xaman signing is the only proof of wallet ownership. The `user_id` FK simply says "this authenticated user connected this wallet via Xaman."

---

## Wallet State Machine

```
           ┌────────────┐
           │  No Auth   │  (user not logged in to Supabase Auth)
           └─────┬──────┘
                 │ sign in / Google OAuth
                 ▼
           ┌────────────┐
           │ Auth Only  │  (logged in, no wallet connected)
           └─────┬──────┘
                 │ Connect Wallet (Xaman QR)
                 ▼
           ┌────────────┐
           │ Fully Auth │  (Supabase session + active wallet)
           └─────┬──────┘
                 │
         ┌───────┴────────┐
         ▼                ▼
  Add more wallets   Sign out / timeout
  (multi-wallet)     → back to No Auth
```

---

## Multi-Wallet Management

Users can connect multiple XRPL wallets. The system supports:

| Action | Implementation |
|---|---|
| Add wallet | Xaman QR flow → upsert into `user_wallets` |
| Switch active | Update `activeAddress` in localStorage + `last_seen_at` in DB |
| Rename | Update `label` in `user_wallets` + local state |
| Remove | Set `status = 'revoked'`, `revoked_at = now()` in DB + remove from local state |
| Disconnect all | Revoke all active wallets in DB + clear all local state |

**Wallet providers supported**:
| Provider | Network | Signing Method |
|---|---|---|
| `xaman` | mainnet or testnet | Xaman QR scan |
| `testnet_faucet` | testnet only | Server-side auto-sign |

**Wallet object shape** (`ConnectedWallet`):
```typescript
interface ConnectedWallet {
  id: string;              // DB UUID
  address: string;         // XRPL r-address
  label: string;           // User-defined or auto-generated
  xamanName: string | null; // Display name from Xaman profile
  provider: string;        // 'xaman' | 'testnet_faucet'
  network: 'testnet' | 'mainnet';
  connectedAt: string;     // ISO timestamp
  lastUsedAt: string;      // ISO timestamp
  status: string;          // 'active' | 'revoked'
}
```

---

## Inactivity Timeout

**Timeout**: 30 minutes of no user interaction
**Activity events tracked**: `mousedown`, `keydown`, `touchstart`, `scroll`, `mousemove`
**Throttle**: Timer only resets if > 60 seconds have passed since the last reset

**On timeout**:
1. `supabase.auth.signOut()` is called → clears Supabase session
2. `ActiveWalletContext` clears wallet list and active address
3. localStorage active wallet key is removed
4. User sees toast: "Session expired due to inactivity. Please sign in again."

**Note**: The Supabase Auth `onAuthStateChange` listener in `useAuth` will detect the sign-out and set `user = null`, which propagates to `ActiveWalletContext` and clears the wallet list via the `useEffect` that depends on `user`.

---

## Audit Logging

All wallet lifecycle events are logged to `wallet_audit_log`. Logging is fire-and-forget — failures never block UI.

| Event | Trigger |
|---|---|
| `connect` | Wallet successfully added via Xaman |
| `disconnect` | Single wallet removed by user |
| `disconnect_all` | All wallets removed |
| `switch_to` | Wallet became active |
| `switch_from` | Wallet was deactivated |

Each event captures: `wallet_address`, `event_type`, `metadata` (JSON), `ip_hint`, `user_agent`, `created_at`.

---

## V2 Recommendations

1. **Remove `wallet_profiles` table** — it's a remnant of the wallet-first (no Supabase Auth) design. `user_wallets` is now authoritative.

2. **Stop double-fetching in `useAuth`** — remove `getSession()` call; `onAuthStateChange` fires immediately with current session.

3. **Add XRPL address verification to more edge functions** — currently only `xrpl-build-payment` and `xrpl-build-token-payment` verify the sender is in `wallet_profiles`. The mint functions do not verify wallet ownership before building transactions.

4. **Consider wallet-first auth for V2** — if the target users are crypto-native, requiring email sign-up before wallet connection creates friction. V2 could support wallet-only sessions using Xaman-signed JWTs or Sign In With XRPL patterns.

5. **Encrypt `wallet_secret` if stored at all** — use Supabase Vault or application-level encryption. Ideally, eliminate storage entirely by using a single platform testnet wallet for auto-sign flows.
