

## Testnet Auto-Sign vs Mainnet Xaman Signing

### Problem
Currently, all mint transactions are sent to Xaman for QR-code signing, regardless of network. Testnet wallets generated via the faucet have a secret key available, but it's thrown away. Testnet wallets should auto-sign and submit without Xaman involvement.

### Architecture

```text
MintWizard: handleSubmit()
  │
  ├─ network === 'testnet' && wallet is faucet-generated?
  │   → call xrpl-submit-signed (new edge function)
  │   → signs with stored secret, submits directly to testnet
  │   → returns tx_hash immediately → show "validated"
  │
  └─ network === 'mainnet' (or non-faucet wallet)
      → call xaman-send-payment (existing)
      → show QR code, poll xaman-check-payload
```

### Changes Required

#### 1. Database: Add `wallet_secret` column to `user_wallets`
- New nullable encrypted column to store the testnet faucet secret
- Only populated for faucet-generated wallets
- Migration: `ALTER TABLE user_wallets ADD COLUMN wallet_secret text;`

#### 2. Edge Function: Update `xrpl-testnet-faucet` to return secret
- The XRPL faucet already returns `data.account.secret` — currently discarded
- Return it alongside address/balance so the frontend can pass it to the DB

#### 3. Frontend: `WalletSelector` — store secret when generating testnet wallet
- After faucet call, save `wallet_secret` and set `provider = 'testnet_faucet'` on the user_wallets record

#### 4. New Edge Function: `xrpl-submit-signed`
- Accepts `tx_json`, `wallet_address`, `network`
- Looks up `wallet_secret` from `user_wallets` (service role)
- Signs the transaction using the XRPL `sign` RPC method
- Submits via `submit` RPC to testnet
- Returns `tx_hash` and `engine_result`

#### 5. Frontend: `MintWizard` — branch on network/provider
- Before submitting, check if the active wallet's provider is `testnet_faucet` and network is `testnet`
- If yes: call `xrpl-submit-signed` instead of `xaman-send-payment`, skip QR/polling, go straight to validated
- If no: existing Xaman flow (QR code + polling)

#### 6. Update `ActiveWalletContext` — expose provider info
- Add `provider` field to `ConnectedWallet` interface so MintWizard can check it

### Files to Create/Modify
- **Migration**: Add `wallet_secret` column to `user_wallets`
- **`supabase/functions/xrpl-testnet-faucet/index.ts`**: Return `secret` in response
- **`supabase/functions/xrpl-submit-signed/index.ts`**: New edge function for server-side signing
- **`supabase/config.toml`**: Register new function with `verify_jwt = false`
- **`src/components/WalletSelector.tsx`**: Pass secret when saving faucet wallet
- **`src/contexts/ActiveWalletContext.tsx`**: Add `provider` to `ConnectedWallet`
- **`src/components/mint/MintWizard.tsx`**: Branch submit logic based on provider/network

### Security Note
- Testnet secrets have no real monetary value — storing them is acceptable
- Mainnet wallets never have secrets stored; they always use Xaman signing
- The `xrpl-submit-signed` function will verify `network === 'testnet'` before proceeding

