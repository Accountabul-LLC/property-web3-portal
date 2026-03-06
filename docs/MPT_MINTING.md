# MPT Minting — Property Web3 Portal (RWA)

> **Status**: V1 prototype reference — testnet only
> **Standard**: XLS-33 (MPToken), XLS-89 (compressed metadata)
> **Last Updated**: 2026-03-06

---

## Overview

MPT (Multi-Purpose Token) is a new XRPL token standard (XLS-33) designed for real-world assets. Unlike traditional XRPL IOU trust lines, MPTs are native ledger objects with built-in compliance features (lock, clawback, auth, escrow, trade).

The platform uses the **XLS-89 compressed metadata schema** to encode property and token information on-chain in ≤1024 bytes (the XRPL `MPTokenMetadata` field limit).

---

## Architecture

```
User (Browser)
│
├─ MintWizard.tsx (orchestrator, 3 steps: type → form → review)
│   ├─ MPTForm.tsx (XLS-89 metadata + RWA property fields)
│   ├─ NFTForm.tsx (XLS-20 NFT)
│   └─ IOUForm.tsx (Trust line issuance)
│
└─ supabase.functions.invoke()
    │
    ├─ xrpl-build-mint  (build MPTokenIssuanceCreate tx_json)
    │
    └─ [testnet faucet wallet]          [mainnet / Xaman wallet]
        xrpl-submit-signed               xaman-send-payment
        (auto-sign, no QR)              → QR code displayed
                                        → xaman-check-payload polls
```

---

## Mint Flow

### Step 1: Type + Wallet Selection

User selects token type (`nft` | `mpt` | `iou`) and a signing wallet. Network (mainnet/testnet) is **derived from the selected wallet's `network` field** — the user does not choose network independently.

Two signing paths exist:
- **Xaman QR** — any wallet with `provider !== 'testnet_faucet'`
- **Auto-sign (testnet)** — wallet with `provider === 'testnet_faucet'`, server signs using stored `wallet_secret`

### Step 2: MPT Form

See [MPT Form Fields](#mpt-form-fields) below.

### Step 3: Review + Submit

Calls `xrpl-build-mint` edge function with:
```typescript
{
  token_type: 'mpt',
  network: 'testnet' | 'mainnet',
  wallet_address: string,  // issuing wallet
  params: MPTParams        // form data
}
```

Edge function returns `tx_json` (a `MPTokenIssuanceCreate` transaction).

**Testnet auto-sign path**:
- Calls `xrpl-submit-signed` with `tx_json` + `wallet_address` + `network`
- Edge function fetches `wallet_secret` from `user_wallets` table
- Signs and submits to testnet XRPL nodes
- Returns `tx_hash`

**Xaman signing path**:
- Calls `xaman-send-payment` with `tx_json` (misnamed — handles any tx type)
- Returns `uuid` + `qr_code` URL
- Frontend polls `xaman-check-payload` every 3 seconds
- On `signed: true` → gets `tx_hash`, updates `token_mints` to `validated`

### Post-Mint

A record is written to the `token_mints` table at submission time and updated when signed/failed:

```sql
token_mints (
  user_id, wallet_address, token_type, network,
  request_json,         -- original form params
  tx_json,              -- built transaction
  status,               -- pending | validated | failed
  tx_hash,              -- set on validated
  xaman_payload_uuid    -- set for Xaman flow
)
```

---

## MPT Form Fields

### Token Identity (XLS-89 `n`, `t`, `i`, `d`)
| Field | XLS-89 Key | Required | Notes |
|---|---|---|---|
| Token Name | `n` | Yes | The name investors see |
| Ticker Symbol | `t` | Yes | 3–5 uppercase letters |
| Token Image | `i` | Recommended | URL (HTTPS or IPFS) or Supabase Storage upload |
| Description | `d` | No | Property description |

### RWA Property Info (stored in `ai` additional_info object)
| Field | `ai` Key | Notes |
|---|---|---|
| Street Address | `adr` | Full street address |
| City | `ct` | |
| State | `st` | 2-letter US state code |
| ZIP | `zip` | |
| Country | `cc` | ISO country code (e.g., `US`) |
| Property Type | `pt` | Short code (see below) |
| Bedrooms | `b` | |
| Bathrooms | `ba` | |
| Square Feet | `sf` | |
| Year Built | `yb` | |
| Estimated Value | `val` | Numeric string |
| Contact Email | `em` | Owner/issuer email |

**Property Type Short Codes** (to save byte space on-chain):
| Code | Display |
|---|---|
| `sfh` | Single Family |
| `mf` | Multi-Family |
| `condo` | Condo / Apartment |
| `th` | Townhouse |
| `comm` | Commercial |
| `ind` | Industrial |
| `land` | Land / Lot |
| `mix` | Mixed-Use |
| `other` | Other |

### Issuer Information (XLS-89 `in`)
| Field | XLS-89 Key | Notes |
|---|---|---|
| Issuer Name | `in` | Legal entity issuing the token |

### Links / URIs (XLS-89 `us` array)
Each URI entry: `{ u: string, c: category, t: title }`

Categories: `website` | `social` | `docs` | `other`

Max 5 URIs per token.

### Token Economics (on-ledger MPTokenIssuanceCreate fields)
| Field | XRPL Field | Notes |
|---|---|---|
| Total Supply | `MaximumAmount` | Max tokens that can be minted |
| Decimal Places | `AssetScale` | 0 = whole tokens, max 15 |
| Transfer Fee | `TransferFee` | 0–50000 (divide by 1000 for %) |

### Token Permissions (XRPL Flags)
| UI Label | Flag | Effect |
|---|---|---|
| Can Transfer | `tfMPTCanTransfer` | Non-issuer accounts can send tokens |
| Can Trade | `tfMPTCanTrade` | Holders can trade on DEX |
| Can Lock | `tfMPTCanLock` | Issuer can freeze individual/global |
| Require Auth | `tfMPTRequireAuth` | Holders need issuer authorization |
| Can Escrow | `tfMPTCanEscrow` | Holders can escrow tokens |
| Can Clawback | `tfMPTCanClawback` | Issuer can claw back tokens |

---

## XLS-89 Metadata Encoding

The final metadata JSON is encoded as:
1. Serialize to JSON string
2. UTF-8 encode
3. Hex encode → store in `MPTokenMetadata` field

**Required fields** per XLS-89: `t` (ticker), `n` (name), `i` (icon/image), `ac` (asset_class), `in` (issuer_name)

**Asset class values**: `rwa` (Real World Asset), `stablecoin`, `fund`, `commodity`, `equity`, `other`

**Asset subclass for RWA** maps to property type short codes above.

**Byte limit**: 1024 bytes total. The `xrpl-build-mint` edge function trims the metadata if it exceeds this limit (removes `d` description first, then trims `ai` fields).

**Example XLS-89 encoded metadata**:
```json
{
  "t": "OAK",
  "n": "99 Oak Hill Lane Token",
  "i": "https://storage.supabase.co/token-logos/abc123.png",
  "d": "Well-maintained multi-family in Portland, OR.",
  "ac": "rwa",
  "as": "mf",
  "in": "Acme Holdings LLC",
  "us": [
    { "u": "example.com/oak", "c": "website", "t": "Property Page" }
  ],
  "ai": {
    "adr": "99 Oak Hill Lane",
    "ct": "Portland",
    "st": "OR",
    "zip": "97201",
    "cc": "US",
    "pt": "mf",
    "b": 8,
    "ba": 4,
    "sf": 3200,
    "yb": 1985,
    "val": 850000,
    "em": "info@acmeholdings.com"
  }
}
```

---

## Parsing MPT Data From XRPL

When reading MPT issuances from a wallet's `account_objects`, the `xrpl-account-data` edge function:

1. Detects metadata format:
   - **XLS-89 compressed**: has `n` or `t` key at root
   - **XLS-24d legacy**: has `name` key at root

2. Parses and normalizes both formats into the same `MPTIssuance` interface

3. Reverses abbreviated `ai` keys to human-readable labels for display

4. Expands property type short codes (`mf` → `Multi-Family`)

---

## Testnet Faucet Wallet

The testnet faucet feature allows developers to create a pre-funded testnet wallet without leaving the app.

**Flow**:
1. User clicks "Generate Testnet Wallet" in MintWizard
2. `xrpl-testnet-faucet` edge function calls the XRPL testnet faucet API
3. Returns `{ address, secret, balance }` — **100 XRP funded**
4. `addWallet()` is called with `provider: 'testnet_faucet'`, `network: 'testnet'`, and `walletSecret: secret`
5. The `wallet_secret` is stored in `user_wallets` DB table (⚠️ security issue — see CODE_AUDIT.md C1)
6. This wallet is then available for auto-sign minting on testnet

**Identifying a faucet wallet**: `selectedWallet.provider === 'testnet_faucet'`

---

## V2 Recommendations

1. **Move MPT to mainnet** — XLS-33 is in active development on XRPL. Track amendment status and enable mainnet support when available.

2. **Remove test data generation from `MPTForm`** — gate behind `import.meta.env.DEV` or remove entirely.

3. **Validate XLS-89 byte size on the frontend** — show a real-time byte counter so users know if their metadata will be trimmed before submitting.

4. **Decouple `MintWizard` from `ActiveWalletContext` internals** — `MintWizard` directly calls `addWallet()` to create faucet wallets, coupling the mint flow to wallet management. These should communicate via events or a service layer.

5. **Add mint history page** — query `token_mints` to show all past mints with status, tx hash, and explorer links.

6. **Support metadata update** — XRPL allows updating `MPTokenMetadata` via `MPTokenIssuanceSet`. Add an edit flow for updating token metadata after minting.

7. **Fix stale closure timeout bug** — see CODE_AUDIT.md C2.

8. **Fix interval leak on unmount** — see CODE_AUDIT.md C3.
