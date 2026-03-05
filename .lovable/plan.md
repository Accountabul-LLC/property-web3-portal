

# Plan: Auth-First Wallet Linking Architecture

## What Changes

Currently, wallet connection is independent of app authentication — anyone can connect a wallet without signing in. This plan ties wallets to authenticated users via a new `user_wallets` table, enforces auth gates, and ensures all wallet actions are scoped to the logged-in user.

## Database Changes

### New table: `user_wallets`
Maps authenticated users to their XRPL wallets. Merges concepts from the existing `wallet_profiles` table with user ownership.

```sql
CREATE TABLE public.user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  label text,
  xaman_account_name text,
  xaman_user_token text,
  avatar_url text,
  provider text NOT NULL DEFAULT 'xaman',
  status text NOT NULL DEFAULT 'active',  -- active | revoked
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(wallet_address)  -- one wallet = one user
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own wallets
CREATE POLICY "Users can read own wallets" ON public.user_wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own wallets" ON public.user_wallets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own wallets" ON public.user_wallets
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own wallets" ON public.user_wallets
  FOR DELETE TO authenticated USING (user_id = auth.uid());
```

The existing `wallet_profiles` and `wallet_audit_log` tables remain for backward compatibility and public-facing data. The new `user_wallets` table is the authoritative ownership mapping.

### Enhance `wallet_audit_log`
Add optional `user_id` column to link audit events to authenticated users:

```sql
ALTER TABLE public.wallet_audit_log ADD COLUMN user_id uuid REFERENCES auth.users(id);
```

## Code Changes

### 1. Update `ActiveWalletContext` — Load/save wallets from database instead of localStorage

- On mount, if user is authenticated, fetch wallets from `user_wallets` table
- `addWallet` writes to `user_wallets` (with `user_id = auth.uid()`) instead of localStorage
- `removeWallet` sets `status = 'revoked'` and `revoked_at` in DB
- `renameWallet` updates `label` in DB
- `disconnectAll` revokes all wallets in DB
- Fall back to localStorage only for unauthenticated browsing (read-only)
- Keep localStorage as a cache for fast hydration, but DB is source of truth

### 2. Gate wallet connection behind auth

- In `Navigation.tsx`: Hide "Connect Wallet" button when user is not logged in. Show "Sign In" instead
- In `WalletConnectModal`: If opened without auth session, redirect to `/auth` or show a message
- The `openConnectModal` function checks `user` first

### 3. Update `xaman-check-payload` edge function

After successful wallet sign-in, the edge function should:
- Accept the authenticated user's JWT (passed via Authorization header)
- Verify the user is authenticated using `getClaims()`
- Write/upsert the `user_wallets` record linking `user_id` to the signed `wallet_address`
- Check if wallet is already linked to a different user — if so, return an error
- Continue updating `wallet_profiles` for backward compatibility

### 4. Server-side ownership verification

Update payment/transaction edge functions (`xrpl-build-payment`, `xrpl-build-token-payment`, `xaman-send-payment`) to:
- Verify the `from_address` belongs to the authenticated user by checking `user_wallets`
- Reject requests where the wallet is not linked to the requesting user

### 5. Update Dashboard page

Add a "Connected Wallets" section to the Dashboard showing:
- List of linked wallets with labels, addresses, status
- "Connect Wallet" button (uses existing Xaman flow)
- Rename/remove wallet actions
- Last active timestamp

### 6. Protect routes

Ensure `/portfolio`, `/dashboard`, send/receive flows require authentication. The existing redirect in `Dashboard` already does this — extend to Portfolio and transaction modals.

## Migration Path

- Existing `wallet_profiles` data stays intact
- On first login after migration, if user has wallets in localStorage but none in `user_wallets`, prompt them to re-link (re-sign with Xaman) to prove ownership — do NOT auto-migrate localStorage addresses without proof
- This prevents wallet hijacking

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration for `user_wallets` table + `wallet_audit_log` column |
| `src/contexts/ActiveWalletContext.tsx` | DB-backed wallet storage, auth-gated operations |
| `src/components/Navigation.tsx` | Hide wallet connect when logged out |
| `src/components/WalletConnectModal.tsx` | Auth check before connect flow |
| `supabase/functions/xaman-check-payload/index.ts` | Link wallet to user_id after sign |
| `src/pages/Dashboard.tsx` | Add connected wallets section |
| `src/pages/Portfolio.tsx` | Auth gate |
| `supabase/functions/xrpl-build-payment/index.ts` | Ownership verification |
| `supabase/functions/xrpl-build-token-payment/index.ts` | Ownership verification |

