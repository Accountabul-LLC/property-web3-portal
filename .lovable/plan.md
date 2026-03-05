

## Fix: Testnet Minting Routes to Xaman Instead of Auto-Sign

### Root Cause

The wallet `rUDCiHjDCAfL3Ne3L9gXmpZgL8B2uDkFVP` is stored in the database with `provider: 'xaman'`, not `testnet_faucet`. There are **zero** faucet wallets in the database. So when the mint wizard checks `activeWallet?.provider === 'testnet_faucet'`, it's always false, and every testnet mint falls through to the Xaman QR signing path — which doesn't work because this is a website-only testnet flow with no external Xaman app involved.

### Solution

Add a **network-wallet mismatch guard** to the mint wizard's review step. When the user selects testnet but their active wallet is NOT a faucet wallet (no server-side secret), show a clear warning with a button to generate a testnet faucet wallet directly from the mint page — reusing the same faucet generation logic already in `WalletSelector.tsx`.

### Changes

#### 1. `src/components/mint/MintWizard.tsx` — Add testnet wallet guard

On the **review step**, when `network === 'testnet' && !isTestnetFaucetWallet`:
- Replace the submit button with a warning card explaining: "Your current wallet was connected via Xaman and can't auto-sign testnet transactions. Generate a testnet wallet to continue."
- Add a "Generate Testnet Wallet" button that calls the `xrpl-testnet-faucet` edge function and uses `addWallet()` from context to save it with `provider: 'testnet_faucet'` + the secret
- After generation, the wallet auto-switches to the new faucet wallet, and the review step updates to show "Auto-sign (testnet)" with the submit button enabled

Also add the same guard on **step 1** (type/network selection): when user picks testnet, show an inline hint if their active wallet isn't a faucet wallet — something like "Tip: You'll need a testnet wallet to auto-sign. You can generate one on the next step."

#### 2. No backend changes needed

The faucet edge function and `xrpl-submit-signed` already support this flow. The `addWallet` context method already accepts `provider` and `walletSecret` params. The only gap is the UI not surfacing the generate-faucet action when the wallet/network combo requires it.

### Files to modify
- `src/components/mint/MintWizard.tsx` — Add testnet wallet mismatch warning + inline faucet generation button

