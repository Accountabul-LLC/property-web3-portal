# Module: Auth System

## Dual Auth Overview

The app has two independent auth systems that are linked via `user_wallets`:

| System | Purpose | Table |
|--------|---------|-------|
| Supabase Auth | Email/Google login, session JWT | `auth.users` + `profiles` |
| Xaman Wallet | XRPL wallet connect via QR sign | `user_wallets`, `wallet_profiles` |

A user can have one Supabase account linked to multiple XRPL wallets.

## Supabase Auth

- `useAuth()` hook — `src/hooks/useAuth.ts` — returns `{ user, loading, signOut }`
- Session stored in localStorage via `supabase.auth.onAuthStateChange`
- `profiles` table mirrors `auth.users` with extra fields (name, address, KYC fields)
- Trigger auto-creates `profiles` row on new user signup

## Xaman Wallet Auth

Flow: user scans QR → Xaman app signs → payload polled → wallet address stored

```
xaman-create-payload  →  QR code shown in WalletConnectModal
xaman-check-payload   →  polled every 2s until signed or expired
                      →  on sign: wallet_address stored in user_wallets
```

- `ActiveWalletContext` (`src/contexts/ActiveWalletContext.tsx`) — global state for connected wallet
- Inactivity timeout: auto-disconnects wallet after idle period (`useInactivityTimeout`)
- All wallet events written to `wallet_audit_log` table

## user_wallets Table

Links Supabase `user_id` to XRPL `wallet_address`:
- `provider`: `'xaman'` or `'testnet'`
- `status`: `'active'` | `'revoked'`
- `wallet_secret`: testnet auto-sign secret — **security issue C1, never use in prod**
- Safe view: `user_wallets_safe` (excludes `wallet_secret`)

## Role System

- Table: `user_roles` — columns: `user_id`, `role`
- Enum `app_role`: `'admin' | 'moderator' | 'user'`
- DB function: `has_role(_role, _user_id)` — returns boolean
- Team access check: `admin` role = internal team
- RLS on sensitive tables uses `auth.uid()` checks

## RLS Pattern

```sql
-- Standard user-owned row policy:
create policy "Users see own data"
  on my_table for all
  using (auth.uid() = user_id);
```

## Key Files

- `src/hooks/useAuth.ts` — session state
- `src/hooks/useTeamAccess.ts` — admin role check
- `src/contexts/ActiveWalletContext.tsx` — wallet state
- `src/components/WalletConnectModal.tsx` — Xaman QR flow
- `src/components/WalletSelector.tsx` — wallet picker
- `supabase/functions/xaman-create-payload/` — initiate wallet connect
- `supabase/functions/xaman-check-payload/` — poll for sign
- `docs/AUTH_SYSTEM.md` — full auth documentation
