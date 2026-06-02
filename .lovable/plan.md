## 1. "View Public Profile" access from Vendor Dashboard

**File:** `src/pages/VendorDashboard.tsx`

- Pull the vendor's slug from `vendorProfile` (already loaded via `useVendorProfile`).
- In the dashboard header card (next to the "Verified vendor" badge / title block), add a prominent `Button asChild` linking to `/vendor/:slug` (using `getVendorPublicUrl(slug)` from `src/lib/vendorNetwork.ts`). Label: **"View Public Profile"** with an `ExternalLink` icon, `target="_blank"`.
- Also surface it inside the existing action row (next to "View marketplace" / "Edit application") so it's reachable from both the hero and the CTA cluster.
- Render only when `vendorProfile?.slug` exists; otherwise show a disabled tooltip "Profile not published yet".

## 2. Evergreen landing copy on Vendors Directory

**File:** `src/pages/VendorsDirectory.tsx`

- Replace the top-right CTA text `"Be the first verified vendor"` (line 81) with **"Become a verified vendor"**.
- Replace the empty-state heading `"Be the first verified vendor"` (line 145) with **"Become a verified vendor"** and update the body copy to a static prompt:
  > "No vendors match the current filters. Adjust your search, or apply to join the verified vendor network."
- Remove all conditional logic tied to "first vendor" framing (there is none beyond the copy itself — purely a text swap).

## 3. Directory cleanup & sidebar consistency

**File:** `src/components/vendor/VendorPublicSidebar.tsx`

- Remove the **Directory** entry from the sidebar items list. The back-to-directory link already exists in the page top bar of `VendorPublicProfile.tsx`, so the sidebar entry is the redundant one.
- Keep Dashboard, Messages (Soon), Favorites. Order: Dashboard, Favorites, Messages.

**Header "revert":** the global `Navigation` component was not changed in the last vendor work — `VendorPublicProfile` simply doesn't render `<Navigation />` (it uses the sidebar shell instead). No revert needed there. The `VendorsDirectory` page already renders the stable `<Navigation />`. No action required on the global header unless a specific regression is pointed out (flag in chat if user meant something else).

## 4. Heart / Favorites retargeting

**File:** `src/components/vendor/VendorPublicSidebar.tsx`

- Change the signed-in Favorites destination from `/portfolio` to **`/marketplace?tab=saved`** (this is the canonical saved-properties view used by `Dashboard.tsx` line 797).
- Keep signed-out behavior (disabled + "Sign in" badge), but make it clickable instead — link to `/auth?next=/marketplace?tab=saved` so users land on saved properties after auth.
- Rename label from "Favorites" to **"Saved Properties"** for clarity, since the platform's saving lives at the property level.

## Out of scope

- No DB/migration changes.
- No new routes.
- No edits to global `Navigation.tsx` or shadcn primitives.

## Files touched

- `src/pages/VendorDashboard.tsx` — add "View Public Profile" button.
- `src/pages/VendorsDirectory.tsx` — swap CTA and empty-state copy.
- `src/components/vendor/VendorPublicSidebar.tsx` — drop Directory item, retarget Favorites to `/marketplace?tab=saved`, rename to "Saved Properties".
