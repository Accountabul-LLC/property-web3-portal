# Module: XRPL Integration

## Core Rule

**Never call XRPL directly from the browser.** All XRPL interactions go through Supabase edge functions. No XRPL SDK imports in frontend code.

## Token Types

| Type | Standard | Use Case |
|------|----------|---------|
| MPT | XLS-89d (Multi-Purpose Token) | Fractional property ownership (preferred) |
| NFT | XLS-20 | Unique property deed representation |
| IOU | Trust lines | Fungible property tokens via issuer |

## MPT Metadata (XLS-89)

- Compressed metadata standard, max **1024 bytes**
- URI field: `{name, description, image, properties{}}`
- See `docs/MPT_MINTING.md` for full spec
- Built by `xrpl-build-mint` edge function

## Edge Functions

| Function | What it does |
|----------|-------------|
| `xrpl-build-mint` | Builds MPT/NFT/IOU mint transaction JSON |
| `xrpl-submit-signed` | Submits a signed transaction to XRPL network |
| `xrpl-account-data` | Fetches account info (balance, sequence, flags) |
| `xrpl-build-payment` | Builds XRP payment transaction |
| `xrpl-build-token-payment` | Builds MPT/IOU token transfer transaction |
| `xrpl-testnet-faucet` | Funds a testnet wallet via faucet |
| `xrpl-token-meta` | Fetches MPT token metadata by ID |
| `xaman-create-payload` | Creates Xaman sign request, returns QR payload |
| `xaman-check-payload` | Polls Xaman for sign status |
| `xaman-send-payment` | Initiates payment via Xaman signing |

## Minting Flow

```
1. User fills MintWizard form (src/components/mint/)
2. useTokenizeForm submits to xrpl-build-mint
3. Edge fn builds transaction JSON
4. Testnet: auto-signs with wallet_secret (security issue C1)
5. Mainnet: sends to Xaman for QR signing
6. xrpl-submit-signed submits signed tx
7. token_mints table records result
```

## Key DB Tables

- `token_mints` — mint attempts (status, tx_hash, request_json, tx_json)
- `token_orders` — buy/sell orders on property tokens
- `token_price_history` — price feed per property
- `user_wallets` — wallet → user_id mapping + wallet_secret (testnet)

## Key Files

- `src/pages/Mint.tsx` — minting page
- `src/components/mint/MintWizard.tsx` — step-by-step wizard
- `src/components/mint/MPTForm.tsx` — MPT-specific form
- `src/hooks/useTokenMeta.ts` — fetch MPT metadata
- `src/hooks/useXRPLPortfolio.ts` — on-chain portfolio
- `src/hooks/useXRPLSubscription.ts` — real-time ledger feed
- `docs/MPT_MINTING.md` — MPT spec
- `docs/TECHNICAL_SPEC.md` — edge function specs

## Gotchas

- XRPL testnet: `wallet_secret` in `user_wallets` enables auto-signing — **never replicate in prod**
- MPT metadata must be ≤ 1024 bytes after compression
- Transaction signing on mainnet always requires Xaman QR flow
- `xrpl-submit-signed` expects already-signed tx blob, not raw tx
