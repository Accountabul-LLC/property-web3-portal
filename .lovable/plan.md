

## Problem

When an MPT (Multi-Purpose Token) is minted, it doesn't show up in the wallet's portfolio. This is because:

1. **The `xrpl-account-data` edge function only fetches `account_lines`** (trust lines / IOU tokens). MPTs are a different ledger object type (`MPTokenIssuance` for issuers, `MPToken` for holders) and require the `account_objects` RPC call to retrieve.

2. **The issuer doesn't hold MPTokens** — they hold `MPTokenIssuance` entries. Holders get `MPToken` entries. So after minting, the issuer's `account_objects` will contain an `MPTokenIssuance` object showing the token they created.

## Plan

### 1. Update `xrpl-account-data` edge function to fetch MPT data

Add an `account_objects` RPC call (filtered to `mptoken_issuance` type) alongside the existing `account_info`, `account_lines`, and `account_tx` calls. Parse the results into a new `mpt_issuances` array (tokens this account issued) and also fetch `mptoken` type objects for tokens this account holds.

Return two new fields:
- `mpt_issuances`: tokens this wallet issued (from `MPTokenIssuance` objects) — includes `MPTokenIssuanceID`, `MaximumAmount`, `OutstandingAmount`, `AssetScale`, metadata, flags
- `mpt_holdings`: MPTs this wallet holds but did not issue (from `MPToken` objects) — includes `MPTokenIssuanceID`, `MPTAmount`

### 2. Update `useXRPLPortfolio` hook types

Add `mpt_issuances` and `mpt_holdings` arrays to the `XRPLPortfolioData` interface.

### 3. Update `PortfolioSection` UI to display MPT tokens

Add a section (or integrate into the existing token holdings list) that shows:
- MPTs issued by this wallet (with name/description decoded from metadata hex, supply info)
- MPTs held by this wallet (with amount and issuance ID)

These will appear alongside existing IOU trust line tokens in the portfolio view.

### Technical Details

**RPC calls to add** (in parallel with existing calls):
```
account_objects({ account, type: "mptoken_issuance", ledger_index: "validated" })
account_objects({ account, type: "mptoken", ledger_index: "validated" })
```

**MPTokenIssuance fields** to parse: `MPTokenIssuanceID`, `MaximumAmount`, `OutstandingAmount`, `AssetScale`, `TransferFee`, `MPTokenMetadata` (hex-encoded JSON with name/description), `Flags`

**MPToken fields** to parse: `MPTokenIssuanceID`, `MPTAmount`, `Flags`

