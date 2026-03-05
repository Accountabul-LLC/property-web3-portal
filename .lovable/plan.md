

## Add Network Awareness to Wallets

### Problem
The system doesn't track which XRPL network a wallet belongs to. A testnet-faucet wallet used on mainnet (or an Xaman mainnet wallet used on testnet) hits `actNotFound` because the account doesn't exist on that ledger. The error message is also hardcoded to say "Fund it first on testnet" regardless of which network was queried.

### Changes

#### 1. Database: Add `network` column to `user_wallets`
- Add column `network text NOT NULL DEFAULT 'mainnet'` to `user_wallets`
- Faucet wallets will be stored with `network = 'testnet'`, Xaman wallets default to `'mainnet'`

#### 2. `ActiveWalletContext.tsx` — Expose wallet network
- Add `network` field to `ConnectedWallet` interface (mapped from DB column)
- Update `addWallet` to accept and persist `network` param
- When adding a faucet wallet, pass `network: 'testnet'`

#### 3. `WalletSelector.tsx` — Show network badge
- Display a small `Testnet` / `Mainnet` badge next to each wallet in the dropdown so users can tell them apart at a glance

#### 4. `MintWizard.tsx` — Auto-match network to wallet + mismatch guard
- Auto-set the mint network selector based on `activeWallet.network`
- If user manually changes network to one that doesn't match their wallet, show a warning: "Your wallet is on [X] but you selected [Y]. Switch wallets or generate a testnet wallet."
- Block submit when there's a mismatch
- Replace the existing `needsFaucetWallet` logic with a more general network mismatch check

#### 5. `xrpl-build-mint/index.ts` — Fix error message
- Change the hardcoded "Fund it first on testnet" to be network-aware: `"Account not found on XRPL ${network}. Fund it first."`

#### 6. `PortfolioSection` — Derive network from wallet
- Use `activeWallet.network` instead of inferring from `provider === 'testnet_faucet'`

### Files to modify
- **Migration**: Add `network` column to `user_wallets`
- `src/contexts/ActiveWalletContext.tsx` — Add network to interface + addWallet
- `src/components/WalletSelector.tsx` — Network badge per wallet
- `src/components/mint/MintWizard.tsx` — Auto-set network, mismatch guard
- `supabase/functions/xrpl-build-mint/index.ts` — Network-aware error message
- `src/components/PortfolioSection.tsx` — Use wallet.network

