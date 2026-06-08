# QA Plan: Standard Property Listing Flow

You're signed in on the Dashboard. I'll drive the preview browser through the full vendor listing flow and report findings (with screenshots) at each step. If I hit a bug, I'll stop and surface it before continuing.

## Steps

1. **Dashboard CTA**
   - Verify the "List a Property" button is present in the Dashboard header.
   - Confirm vendor status badge ("Registered" / "Under Review") renders correctly.
   - Click the CTA, confirm navigation to `/list-property`.

2. **List Property form (`/list-property`)**
   - Verify form renders for a vendor profile (no gating errors).
   - Fill required fields (title, description, address, list price, contact email/phone, property type).
   - Upload 2-3 test images, confirm previews render and 8-image/6MB limits behave.
   - Submit and verify success toast + redirect.
   - Confirm a row was inserted into `public.properties` with `listing_kind='standard'`, `status='active'`, `images[]` populated with signed URLs from the `property-images` bucket (via `supabase--read_query`).

3. **Marketplace disclaimer + filter (`/marketplace`)**
   - First-visit: disclaimer modal appears. Test "Don't show again" persists in localStorage on reload.
   - Confirm the new listing appears with a "Standard" badge (not "Tokenized").
   - Toggle the listing-kind filter; verify it filters correctly.
   - Card shows list price + contact affordance, not yield/funding progress.

4. **Property detail (`/property/:id`)**
   - Open the new listing.
   - Confirm `StandardListingSidebar` renders (list price + Contact Lister mailto/tel), not the tokenized FinancialSidebar.
   - Confirm tokenization-only tabs (Financials, Order Book, Market) and PriceChart are hidden.
   - Confirm the standard-listing warning banner renders at top.
   - Verify images render in the gallery.

5. **Regression check on a tokenized listing**
   - Open an existing tokenized property and confirm the tokenized sidebar, tabs, and PriceChart still render normally (no collateral damage).

6. **Em-dash sweep**
   - Spot-check the screens touched above for any remaining `—` / `–` characters in visible copy.

## Reporting

For each step I'll capture a screenshot and a one-line pass/fail. At the end I'll list any defects with file references so you can decide what to fix.

## Notes / caveats

- I will not perform destructive actions (no deletes, no edits to other users' data).
- The form submit creates a real row in `properties`; I'll leave it in place so you can inspect it, unless you'd like me to clean it up after.
- If sign-in/session has expired by the time I start, I'll stop and ask you to re-auth.
