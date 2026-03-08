

# Remove Network from Wallet Registration — Clean Up Deprecated Logic

## Summary

The `network` field on `ConnectedWallet` and in the `user_wallets` DB table is a leftover from when each wallet was tied to a specific network. Now that network is a global viewing context (toggle), storing it per-wallet is misleading. The wallet registration should only store *that* a wallet is connected, not *which network* it views.

## Changes

### 1. `ConnectedWallet` interface (`ActiveWalletContext.tsx`)
- Remove `network` property from the `ConnectedWallet` interface
- Remove `network` parameter from `addWallet` and `onWalletConnected` signatures
- Stop spreading `network` into the upsert payload
- Remove network mapping from both wallet-fetch locations (lines ~105, ~208)

### 2. `addWallet` cleanup (`ActiveWalletContext.tsx`)
- Remove the `network?: XRPLNetwork` parameter
- Remove `...(network ? { network } : {})` from the upsert object
- Update `onWalletConnected` to not pass network

### 3. `WalletSelector.tsx`
- Remove `w.network` references — the badge already uses `activeNetwork` from context (done in prior change)
- Update `handleGenerateTestnet` — stop passing `'testnet'` as network to `addWallet`; the provider `'testnet_faucet'` already distinguishes these wallets
- Update explorer link to use `activeNetwork` instead of `w.network`

### 4. `WalletConnectModal` / `onWalletConnected` callers
- Remove the network argument from any call to `onWalletConnected`

### 5. Database — no migration needed now
- The `network` column can remain in `user_wallets` with its default `'mainnet'` — it becomes inert. Removing it via migration is optional and can be done later without breaking anything. The code will simply stop writing to it.

### What stays
- `activeNetwork` global state (toggle-driven) — unchanged
- `useXRPLPortfolio` and explorer links driven by `activeNetwork` — unchanged
- `provider: 'testnet_faucet'` still stored to identify faucet-generated wallets for auto-sign in MintWizard

