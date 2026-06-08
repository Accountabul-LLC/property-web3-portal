
## Goal

Today the only way a property reaches the marketplace is through the tokenization flow (`/tokenize` → admin approval → status `approved`/`active`). We're opening a second lane: any signed-in user with a **business (vendor) profile** can list a regular, non-tokenized property directly. The marketplace will mix both kinds of listings, badge them clearly, and gate entry behind a disclaimer.

## What we'll build

### 1. Data model
Add to `public.properties`:
- `listing_kind text` — `'standard'` (non-tokenized) or `'tokenized'`. Default `'tokenized'` so existing rows stay correct.
- `listing_price numeric` — sale/list price for standard listings (tokenized ones keep using token fields).
- `vendor_profile_id uuid` — FK to `vendor_profiles.id`, set when a business posts a standard listing.
- `contact_email text`, `contact_phone text` — how a buyer reaches the lister.

RLS / status flow for standard listings:
- Insert allowed only when the user has a row in `vendor_profiles` (verified or not) and `listing_kind = 'standard'`.
- Standard listings skip the admin tokenization pipeline: they go straight to `status = 'active'` on submit (still editable/removable by owner; admins can take down).
- Tokenized flow is unchanged.

### 2. New "List a Property" flow for businesses
- New route `/list-property` (separate from `/tokenize`) with a short form: title, address (Places autocomplete), property type, beds/baths/sqft, photos, description, list price, contact email/phone.
- Gate: if user has no `vendor_profiles` row → redirect to `/vendor/onboarding` with a banner explaining a business profile is required.
- Entry points: button on Dashboard, button on Marketplace ("List your property"), CTA on `VendorDashboard`.
- The existing `/tokenize` page stays as-is for the tokenization path.

### 3. Marketplace disclaimer modal
- Shows on every visit to `/marketplace` by default.
- "I understand — don't show this again" checkbox; if checked, store consent in `localStorage` (`marketplace_disclaimer_ack_v1` with timestamp). Future visits skip the modal.
- Copy makes clear: listings are posted by third parties, may or may not be tokenized, platform is not a broker, do your own due diligence, verify the lister, etc.
- Modal blocks the listings grid until acknowledged (single click for that visit, or permanent dismiss).

### 4. Marketplace UI changes
- Mix standard + tokenized listings in the same grid.
- Each card shows a clear badge: **"Standard Listing"** (neutral) vs **"Tokenized"** (primary/brand color).
- Filter chip row gets a new toggle: All / Standard / Tokenized.
- Standard-listing card shows list price + contact CTA instead of token price / projected yield.
- `PropertyDetail` page renders a different sidebar for `listing_kind = 'standard'`: list price, "Contact lister" button (mailto/tel), prominent "This is a standard listing — not a tokenized asset" notice. Tokenized layout untouched.

### 5. Copy + safety
- Disclaimer text drafted to mirror the Facebook-Marketplace-style "platform only" framing you described.
- Small persistent banner at the top of `/marketplace` after dismissal: "Standard listings are posted by third parties. Verify before transacting."

## Out of scope (for this pass)
- Payments / escrow for standard listings.
- Mandatory KYC or vendor verification before listing.
- Messaging/inbox between buyer and lister (we'll just expose contact info).
- Moderation queue (admins can still remove, but no pre-approval).

## Technical notes
- Migration adds the new columns + a new INSERT policy on `properties` that requires `EXISTS (vendor_profiles where user_id = auth.uid())` when `listing_kind = 'standard'`. Existing tokenization policies stay.
- New hook `useListProperty` for the standard-listing form; `useProperties` extended to return `listing_kind` and updated filter params.
- Disclaimer lives in `src/components/marketplace/MarketplaceDisclaimerModal.tsx`; storage key versioned so we can force re-consent later.
- No edge function needed — standard listings are a plain insert under RLS.

## Files touched (approx.)
- New migration on `public.properties`.
- New: `src/pages/ListProperty.tsx`, `src/components/marketplace/MarketplaceDisclaimerModal.tsx`, `src/hooks/useListProperty.ts`.
- Edit: `src/App.tsx` (route), `src/pages/Marketplace.tsx`, `src/components/PropertyListingsSection.tsx` (badges + filter + modal mount), `src/components/property/*` (standard-listing sidebar), `src/hooks/useProperties.ts`, `src/pages/Dashboard.tsx` + `VendorDashboard.tsx` (CTA).
