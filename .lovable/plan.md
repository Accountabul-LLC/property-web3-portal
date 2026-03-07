## Plan: Connect Minting to Marketplace Listings — COMPLETED

### Changes Applied

1. **Database migration** — Added `property_id` (nullable uuid FK → properties) to `token_mints`. Updated RLS on `properties` to allow public reads for both `approved` and `active` statuses.

2. **Property selector in MintWizard** — When minting an MPT, users see a dropdown of their approved properties. Selecting one pre-fills all metadata (name, address, beds, baths, sqft, year, value, image, description). The `property_id` is stored on the `token_mints` record.

3. **Post-mint activation** — After successful mint (both auto-sign testnet and Xaman QR flows), linked properties are automatically updated to `status = 'active'`, making them appear in the marketplace.

4. **Marketplace updates** — `useProperties` hook now fetches `status IN ('approved', 'active')`. `PropertyListingsSection` updated with new status labels ("Listed" for active, "Approved" for approved) and matching badge colors.

### New Files
- `src/hooks/useApprovedProperties.ts` — Fetches the current user's approved properties for the property selector.

### Flow
```text
Owner submits property → admin approves → owner mints MPT (linked to property)
    → property status becomes "active" → appears in marketplace as "Listed"
```
