## Goal
Advance `/vendor/:slug` to match the attached mockup: an in-page left sidebar, a single Verified Network Partner badge, an About card showing Industry + Member Since, and a Products & Services area wired to a real backend table.

## 1. Visitor sidebar (scoped to this page only)
- New component `src/components/vendor/VendorPublicSidebar.tsx` rendered only inside `VendorPublicProfile`. Top nav (`Navigation`) and `Footer` are removed from this page.
- Layout shell: `SidebarProvider` + `Sidebar collapsible="icon"` + main content area, full-height.
- Sidebar contents:
  - Brand: "Accountabul" wordmark linking to `/`.
  - Primary group: Directory (`/vendors`), Dashboard (`/dashboard`), Messages (placeholder, disabled with "Soon" tag), Favorites (`/portfolio` or disabled placeholder — see decision below).
  - Footer group: Help & Support (mailto/`/support` placeholder), Sign out (calls `supabase.auth.signOut()` then redirects to `/`). If the visitor is not signed in, Sign out becomes "Sign in" linking to `/auth`.
- Active route highlighting via `useLocation`. Mobile: `collapsible="offcanvas"` with a visible `SidebarTrigger` in the page header.

## 2. Header & badges
- Remove the back-button row and inline Share/Contact bar; move Share + Contact buttons to a top header strip aligned right (matches mockup).
- Add a single "Back to directory" link above the company name (left side).
- Single badge: `Verified Network Partner` (BadgeCheck, primary blue). Drop the KYC badge entirely.
- Tagline under the name = `industry_category` (e.g. "Technology Services & Consulting"), then `business_description` as the supporting paragraph.

## 3. Contact Information card (left column, narrower)
- Title "Contact Information".
- Address (clickable → Google Maps), email (mailto), phone (tel), website (external). Icons match mockup (MapPin, Mail, Phone, Globe).
- Primary "Send Message" button at the bottom that opens `VendorLeadModal`.

## 4. About This Company card (under Contact)
- Industry: from `industry_category`.
- Member Since: formatted `created_at` as "Month YYYY".
- Drop years-in-business and service-areas rows from this card to match mockup.

## 5. Products & Services (main column) — wired to real data
- Create new public-readable table `vendor_products` (see Technical section).
- New hook `src/hooks/useVendorProducts.ts` fetches products for `vendor_profile_id`.
- Empty state matches mockup: centered package icon, "No products or services listed yet. This vendor hasn't published their offerings. Check back soon!"
- Populated state: responsive grid of product cards (image, name, short description, price). Each card links to `/vendor/:slug/shop/:productId` (route stubbed; detail page out of scope for this pass).
- "View all" link in card header goes to `/vendor/:slug/shop` (route stubbed; full shop page out of scope).

## 6. Out of scope
- The full `/vendor/:slug/shop` listing page and product detail page (placeholder routes only).
- Vendor-side product CRUD UI in the Vendor Dashboard (we only set up the table + RLS so vendors *can* manage it via Supabase in the meantime; UI to follow).
- Global sidebar shell across the app.

---

## Technical section

### New table `public.vendor_products`
Columns:
- `id uuid pk default gen_random_uuid()`
- `vendor_profile_id uuid not null` (references `vendor_profiles.id`)
- `user_id uuid not null` (owner — for RLS)
- `name text not null`
- `description text`
- `price_cents integer` (nullable; null = "Contact for pricing")
- `currency text default 'USD'`
- `image_url text`
- `category text`
- `is_published boolean default false`
- `sort_order integer default 0`
- `created_at`, `updated_at` timestamps + trigger using existing `set_updated_at()`.

GRANTs: `SELECT` to `anon` + `authenticated` (public profile is public-readable); full CRUD to `authenticated`; `ALL` to `service_role`.

RLS policies:
- Public read: `is_published = true` (anon + authenticated).
- Owner read all own: `user_id = auth.uid()`.
- Owner insert/update/delete: `user_id = auth.uid()` AND `vendor_profile_id` belongs to that user.
- Admin full access via `has_role(auth.uid(), 'admin')`.

Index on `(vendor_profile_id, is_published, sort_order)`.

### Files touched
- `src/pages/VendorPublicProfile.tsx` — full layout rewrite per above; removes top `Navigation` + `Footer` for this page.
- `src/components/vendor/VendorPublicSidebar.tsx` — new.
- `src/hooks/useVendorProducts.ts` — new (React Query, 30s stale).
- `src/lib/vendorNetwork.ts` — extend `VendorPublicProfileRecord` type if `created_at` not already exposed by the `vendor_public_profiles` view (verify before edit; if missing, the view needs to be updated in a follow-up — flagged in plan).

### Decisions to confirm during build
- Favorites link target: route to `/portfolio` or hide entirely if no good destination exists today? Default: hide if signed-out, link to `/portfolio` if signed-in.
- Messages: keep visible but disabled with "Soon" badge (no route exists).
