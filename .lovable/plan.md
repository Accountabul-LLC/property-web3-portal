

## Plan: Connect Minting to Marketplace Listings

### Current State
- **Tokenize page** (`/tokenize`): Submits property data to `properties` table with status `submitted` for admin review
- **Mint page** (`/mint`): Mints XRPL tokens (NFT/MPT/IOU) via `token_mints` table — but has **no link** to `properties`
- **Marketplace** (`/marketplace`): Reads from `properties` where `status = 'approved'` (RLS enforced)
- **Gap**: `token_mints` has no `property_id` column. After minting, there's no way to mark a property as "tokenized and marketplace-ready"

### What Changes

**1. Database: Link token_mints to properties**
- Add `property_id` (nullable uuid) to `token_mints` table
- Add new property status value `active` (meaning: approved + tokens minted + listed on marketplace)
- Update the marketplace RLS to also show `status = 'active'` properties

**2. Post-Mint: Update property status to "active"**
- After a successful mint in `MintWizard`, if the mint is linked to a property, update that property's status from `approved` → `active`
- This makes it appear in the marketplace automatically

**3. MintWizard: Add optional property selector**
- When minting an MPT, show a dropdown of the user's `approved` properties (from tokenization pipeline)
- Pre-fill MPT metadata (address, beds, baths, etc.) from the selected property
- Store the `property_id` on the `token_mints` record

**4. Marketplace query update**
- `useProperties` hook: change the query to fetch properties with `status IN ('approved', 'active')` — or just `active` if only fully-minted properties should show
- `PropertyListingsSection`: update status badge/filter options to reflect the new lifecycle

### Flow Summary
```text
Owner submits property → admin approves → owner mints MPT (linked to property)
    → property status becomes "active" → appears in marketplace
```

### Files to Change
- **Migration**: Add `property_id` to `token_mints`, update `properties` RLS to include `active` status
- `src/components/mint/MintWizard.tsx` — property selector + post-mint status update
- `src/hooks/useProperties.ts` — adjust query for marketplace-visible statuses
- `src/components/PropertyListingsSection.tsx` — update filter/status options

