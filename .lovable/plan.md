

# Multi-Network Wallet Connect (Testnet + Devnet Support)

## Current State

The architecture already supports `mainnet` and `testnet` networks across edge functions, the WebSocket subscription hook, and the wallet context. The `user_wallets` table has a `network` column (`text`, default `'mainnet'`). What's missing is **devnet** support and the ability for admins to **choose a network** when connecting via Xaman.

## Changes

### 1. Expand Network Type Across the Codebase

Add `'devnet'` as a third network option everywhere the type `'mainnet' | 'testnet'` appears:

- **`src/contexts/ActiveWalletContext.tsx`** — `ConnectedWallet.network` type becomes `'mainnet' | 'testnet' | 'devnet'`
- **`src/hooks/useXRPLSubscription.ts`** — Add devnet WebSocket pool: `['wss://s.devnet.rippletest.net:51233']`
- **`src/components/WalletSelector.tsx`** — Network badge handles `devnet` (amber styling like testnet)

### 2. Add Network Selector to WalletConnectModal (Admin-Only)

**File: `src/components/WalletConnectModal.tsx`**

- Query `has_role(auth.uid(), 'admin')` to detect admin users
- If admin, show a network selector (radio group or segmented control) on the `'select'` step with options: Mainnet, Testnet, Devnet
- Non-admins only see Mainnet (current behavior)
- Pass selected `network` to `xaman-create-payload` in the request body
- Pass `network` through to `onWalletConnected` callback so the wallet is stored with correct network

### 3. Update `onWalletConnected` Signature

**File: `src/contexts/ActiveWalletContext.tsx`**

- Extend `onWalletConnected` to accept an optional `network` parameter
- Pass it through to `addWallet` so the `user_wallets` row records the correct network

### 4. Update Edge Functions with Devnet Nodes

**`supabase/functions/xrpl-account-data/index.ts`**
- Add `DEVNET_NODES = ['https://s.devnet.rippletest.net:51234']`
- Select nodes based on `network === 'devnet'`

**`supabase/functions/xrpl-build-mint/index.ts`**, **`xrpl-build-payment/index.ts`**, **`xrpl-build-token-payment/index.ts`**, **`xrpl-submit-signed/index.ts`**
- Add devnet node arrays and routing (same pattern as testnet)

**`supabase/functions/xaman-create-payload/index.ts`**
- Accept optional `network` field from request body
- Store `network` alongside payload in `xaman_payloads` (informational, no schema change required — can store in existing columns or just log it)

### 5. WalletSelector Explorer Links

**File: `src/components/WalletSelector.tsx`**

- Add devnet explorer URL: `https://devnet.xrpl.org/accounts/${address}`
- Update `getExplorerUrl` to handle `network === 'devnet'`

## No Database Changes Required

The `user_wallets.network` column is `text` type — it already accepts `'devnet'` without a migration.

## Summary Table

| File | Change |
|------|--------|
| `WalletConnectModal.tsx` | Add admin network selector, pass network to edge fn + callback |
| `ActiveWalletContext.tsx` | Extend `onWalletConnected` and network type to include `'devnet'` |
| `useXRPLSubscription.ts` | Add devnet WebSocket endpoint |
| `WalletSelector.tsx` | Add devnet badge color + explorer URL |
| `xrpl-account-data/index.ts` | Add devnet HTTP nodes |
| `xrpl-build-mint/index.ts` | Add devnet HTTP nodes |
| `xrpl-build-payment/index.ts` | Add devnet HTTP nodes |
| `xrpl-submit-signed/index.ts` | Add devnet HTTP nodes |
| `xaman-create-payload/index.ts` | Accept network param from body |

