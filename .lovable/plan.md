

## Migrate MPT Metadata to XRPL Compressed Key Format (XLS-89)

The current implementation uses verbose XLS-24d metadata keys (`name`, `description`, `image`, `collection`, `attributes` with `trait_type`/`value` pairs) which wastes bytes in the 1024-byte on-chain limit. The user has provided the XRPL-recommended compressed key schema that fits far more data.

### What Changes

**1. Edge function: `xrpl-build-mint/index.ts` — metadata encoding**

Replace the current XLS-24d metadata builder (lines 174-240) with the compressed key format:

```json
{"t":"TKR","n":"Token Name","d":"Short desc","i":"ipfs://CID","ac":"rwa","as":"real_estate","in":"Issuer Name","us":["https://verify.url"],"ai":{"adr":"123 Main St","ct":"Miami","st":"FL","zip":"33101","cc":"US","pt":"sfh","b":3,"ba":2,"sf":1800,"yb":2005,"val":350000,"cur":"USD","asof":"2026-03-05"}}
```

Key mapping:
- `t` = ticker (derived from token name, e.g. first 3-5 chars uppercase)
- `n` = name
- `d` = description (truncated short)
- `i` = icon/image URI
- `ac` = asset class ("rwa")
- `as` = asset subclass (property type mapped to short codes: "sfh", "mf", "condo", "comm", etc.)
- `in` = issuer name
- `us` = URIs array (verification links)
- `ai` = additional info object with compact property keys (`adr`, `ct`, `st`, `zip`, `cc`, `pt`, `b`, `ba`, `sf`, `yb`, `val`, `cur`, `asof`)

Remove `schema`, `nftType`, `collection`, and `attributes` array format entirely. The trimming logic stays but is simplified since the compact format is much smaller.

**2. Edge function: `xrpl-account-data/index.ts` — metadata decoding**

Update `parseMPTIssuances()` to detect and decode both formats:
- **New format**: Look for `t`, `n`, `d`, `i`, `ac`, `ai` keys and map them back to the `MPTIssuance` interface fields
- **Legacy format**: Keep existing XLS-24d parsing as fallback for previously minted tokens

Map compressed keys back to display fields:
- `n` or `name` → `name`
- `d` or `description` → `description`  
- `i` or `image` → `image`
- `ai.adr`, `ai.ct`, etc. → reconstruct `attributes` array for display
- `ac`/`as` → could populate `collection` for backward compatibility

**3. Interface: `useXRPLPortfolio.ts` — MPTIssuance type**

Add optional fields to capture new metadata:
- `ticker: string | null`
- `asset_class: string | null`
- `asset_subclass: string | null`  
- `issuer_name: string | null`
- `uris: string[] | null`

**4. Portfolio display: `PortfolioSection.tsx`**

- Show ticker badge next to name when available
- Display issuer name in expanded view
- Show URIs as clickable verification links
- Property facts from `ai` rendered in the existing attribute grid (already works if we reconstruct the attributes array during decoding)

**5. MPT Form: `MPTForm.tsx`**

- Remove "Collection Name" and "Collection Family" fields (no longer part of on-chain schema)
- Add a "Ticker" field (3-5 uppercase chars, auto-suggested from name)
- Update the info text about on-chain metadata to reflect the compressed format
- Remove `collection_name` and `collection_family` from `MPTParams` interface

### Property Type Short Code Map

```text
Single Family   → sfh
Multi-Family    → mf
Condo/Apartment → condo
Townhouse       → th
Commercial      → comm
Industrial      → ind
Land/Lot        → land
Mixed-Use       → mix
Other           → other
```

### Backward Compatibility

The decoder in `xrpl-account-data` will handle both old XLS-24d tokens (already on-chain) and new compressed tokens seamlessly by checking for key presence (`n` vs `name`).

