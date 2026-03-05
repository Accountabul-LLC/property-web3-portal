

# Adopt XLS-24d Metadata Structure for MPT Tokens

## Problem

Currently, MPT metadata is a flat JSON object with just `name` and `description`. The XLS-24d standard defines a richer, interoperable structure with `schema`, `nftType`, `name`, `description`, `image`, `collection`, and `attributes` -- enabling marketplace interoperability and structured property data.

## What Changes

### 1. Restructure MPT metadata to follow XLS-24d pattern

Instead of the current flat `{ name, description }`, the MPTokenMetadata will be structured as:

```json
{
  "schema": "https://raw.githubusercontent.com/x-Tokenize/XLS-24D/main/rwa.v0.schema.json",
  "nftType": "rwa.v0",
  "name": "123 Oak Street Token",
  "description": "Fractional ownership of residential property...",
  "image": "",
  "collection": {
    "name": "RWA Property Tokens",
    "family": "Real Estate"
  },
  "attributes": [
    { "trait_type": "Property Address", "value": "123 Main St" },
    { "trait_type": "City", "value": "Miami" },
    { "trait_type": "State", "value": "FL" },
    { "trait_type": "ZIP", "value": "33101" },
    { "trait_type": "Country", "value": "US" },
    { "trait_type": "Property Type", "value": "Single Family" },
    { "trait_type": "Bedrooms", "value": 3 },
    { "trait_type": "Bathrooms", "value": 2 },
    { "trait_type": "Square Feet", "value": 1800 },
    { "trait_type": "Year Built", "value": 2005 },
    { "trait_type": "Estimated Value (USD)", "value": 350000 },
    { "trait_type": "Owner", "value": "Jane Doe" },
    { "trait_type": "Contact", "value": "jane@example.com" }
  ]
}
```

### 2. Update MPTForm UI

Add optional fields for:
- **Image URL** (IPFS or HTTPS link for a property photo/thumbnail)
- **Collection name** (defaults to "RWA Property Tokens") and **collection family** (defaults to "Real Estate")

These sit in the existing "Property Information" card section. All existing RWA fields (address, beds, baths, etc.) remain unchanged but will be serialized as `attributes` instead of flat metadata keys.

### 3. Update edge function (`xrpl-build-mint`)

Change the MPT metadata builder (lines 174-180) to construct the XLS-24d structure: map all RWA form fields into the `attributes` array, include `schema`, `nftType`, `collection`, and `image` at the top level, then hex-encode the full object into `MPTokenMetadata`.

### 4. Update portfolio metadata decoder (`xrpl-account-data`)

The existing `parseMPTIssuances` function already tries to JSON-parse the decoded metadata hex. Update it to recognize the XLS-24d structure: extract `name` and `description` from top-level fields (already works), and additionally parse the `attributes` array, `collection`, `image`, and `nftType` into the returned issuance object.

### 5. Update portfolio display (`PortfolioSection`)

When rendering MPT issuance cards, if the decoded metadata contains `attributes`, display them as a structured list of trait_type/value pairs. Show the `collection` name and `image` if present.

### Files to modify
- `src/components/mint/MPTForm.tsx` -- add image URL and collection fields to interface and form
- `supabase/functions/xrpl-build-mint/index.ts` -- build XLS-24d structured metadata
- `supabase/functions/xrpl-account-data/index.ts` -- parse XLS-24d attributes from metadata
- `src/components/PortfolioSection.tsx` -- render attributes in MPT issuance cards

