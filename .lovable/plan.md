

## Token Mint Sandbox — Implementation Plan

This builds a "Create Token" wizard that lets users mint NFTs, MPTs, and IOUs on XRPL directly from their connected wallet (Option A: user-is-issuer). The existing Xaman signing flow (`xaman-send-payment` + `xaman-check-payload`) is reused for all transaction types.

### Architecture

```text
┌─────────────────────────────────────────────┐
│  /mint  (new page)                          │
│  ┌─────────────────────────────────────┐    │
│  │ Step 1: Pick token type + network   │    │
│  │   [NFT]  [MPT]  [IOU]              │    │
│  │   Network: [Testnet ▼]             │    │
│  ├─────────────────────────────────────┤    │
│  │ Step 2: Type-specific form          │    │
│  │   (NFT: URI, flags)                 │    │
│  │   (MPT: symbol, max supply, flags)  │    │
│  │   (IOU: currency code, amount, dest)│    │
│  ├─────────────────────────────────────┤    │
│  │ Step 3: Review + Sign via Xaman     │    │
│  │   Status: Pending → Signed → Done   │    │
│  │   TX Hash + Explorer link           │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Database

New `token_mints` table to track mint requests:

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | references auth.users |
| wallet_address | text | signing wallet |
| token_type | text | 'nft' / 'mpt' / 'iou' |
| network | text | 'testnet' / 'mainnet' |
| request_json | jsonb | form inputs |
| tx_json | jsonb | built XRPL transaction |
| status | text | draft/pending/signed/validated/failed |
| tx_hash | text | on-chain hash |
| xaman_payload_uuid | text | Xaman payload tracking |
| created_at / updated_at | timestamptz | |

RLS: users can read/insert/update their own rows.

### New Edge Function: `xrpl-build-mint`

Accepts `{ token_type, network, wallet_address, params }` and returns the appropriate `tx_json`:

- **NFT**: Builds `NFTokenMint` with URI (hex-encoded), optional flags (tfTransferable, tfBurnable)
- **MPT**: Builds `MPTokenIssuanceCreate` with AssetScale, MaximumAmount, optional flags (tfClawback, tfTransferable)
- **IOU**: Two-step — first builds `TrustSet` (for the destination), then `Payment` of the issued currency

Fetches account sequence + current ledger from the selected network node (`s.altnet.rippletest.net:51234` for testnet, `xrplcluster.com` for mainnet). Includes auth + wallet ownership verification (same pattern as `xrpl-build-payment`).

### Frontend Components

1. **`src/pages/Mint.tsx`** — Protected route at `/mint`, renders Navigation + MintWizard + Footer
2. **`src/components/mint/MintWizard.tsx`** — 3-step wizard managing state, calls edge functions, handles Xaman signing flow
3. **`src/components/mint/NFTForm.tsx`** — URI input, flag checkboxes
4. **`src/components/mint/MPTForm.tsx`** — Symbol, max supply, asset scale, flag checkboxes
5. **`src/components/mint/IOUForm.tsx`** — Currency code, amount, destination address
6. **`src/components/mint/MintStatus.tsx`** — Displays pending/signed/validated/failed states with tx hash + explorer link

### Signing Flow (reuses existing infrastructure)

1. Frontend calls `xrpl-build-mint` to get `tx_json`
2. Frontend calls `xaman-send-payment` with the `tx_json` (works for any transaction type, not just Payment)
3. Frontend polls `xaman-check-payload` for signing status
4. On success, updates `token_mints` row with tx_hash and status

### Navigation Update

Add a "Create Token" button/link accessible from the Dashboard or as a new nav item. Since the existing Tokenize page is property-specific, this will be a separate `/mint` route.

### Implementation Order

1. Create `token_mints` table + RLS policies
2. Build `xrpl-build-mint` edge function (NFT first, then MPT, then IOU)
3. Build frontend wizard page + components
4. Add route to App.tsx + navigation link
5. Wire up Xaman signing + status polling

