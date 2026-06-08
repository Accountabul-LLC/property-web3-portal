# Plan: QA standard listing flow + remove em dashes

## Part 1 — End-to-end QA as a business vendor

I'll drive the preview browser as a signed-in user that has a vendor (business) profile and walk the full standard-listing path, capturing screenshots and console/network signals at each step.

Steps I'll execute:
1. Open `/` and confirm sign-in state. If the preview user is not signed in, stop and ask you to log in (I won't fill auth forms without permission).
2. Verify the user has a vendor profile. If not, go to the vendor onboarding page and create a minimal business profile so the listing gate passes.
3. Land on `/dashboard` and confirm the "List a Property" CTA button is present in the header (and on `/vendor` dashboard).
4. Click the CTA → `/list-property`. Fill the form:
   - Title, description, address, city/state/zip
   - List price, beds/baths/sqft
   - Contact email + phone
   - Upload 2–3 test images (verify multi-upload to `property-images` bucket works, 6MB cap respected)
5. Submit and confirm:
   - Row inserted into `properties` with `listing_kind='standard'`, `status='active'`, `vendor_profile_id` set, signed image URLs stored in `images[]`
   - Redirect / success toast fires
6. Go to `/marketplace`:
   - Disclaimer modal shows on first visit; dismiss with "Don't show again" and confirm `localStorage` key is set and modal doesn't reappear on reload
   - Filter by "Standard" listing kind and confirm the new property appears with a "Standard Listing" badge
   - Confirm card shows list price + contact info (not yield/progress)
7. Open the property detail page:
   - Top warning banner renders
   - `StandardListingSidebar` shows (list price + Contact Lister mailto/tel buttons), NOT the tokenized FinancialSidebar
   - Tokenization-only tabs (Financials, Order Book, Market) and PriceChart are hidden
8. Report findings: anything broken, missing, or off-spec gets fixed in a follow-up build pass.

If anything blocks the flow (missing vendor profile UI, RLS error, upload failure, etc.), I'll stop, report what I found, and propose the fix before continuing.

## Part 2 — Remove em dashes site-wide

Scope: 136 em dash (`—`) occurrences across `src/` (pages, components, config, lib). Replacement strategy, applied case-by-case:
- Sentence joiners ("X — not Y", "Required when rejecting — this will be on record") → rewrite with a period, comma, colon, or parenthetical so the sentence reads naturally without a dash. No hyphen substitution unless it actually reads well.
- Placeholder/empty-state glyphs (`'—'` for null values in tables like AdminKyc, MyDonations, AccountBilling) → replace with `'–'` en dash? No — per your rule, no em dashes at all, and we shouldn't sneak an en dash either. Use plain text `'N/A'` (or `'-'` single hyphen for compact table cells) — I'll pick per context and keep it consistent within a file.
- Code comments / JSDoc headers (e.g. `AdminCredentials.tsx` header, `treasuryWallets.ts`) → replace with `-` or rephrase. Comments are lower priority but included for full cleanup.
- Decorative box-drawing comments (`/* ── Section ── */`) → replace with `// Section` style.

I'll also add a memory rule so I never reintroduce em dashes:
- `mem://style/no-em-dashes` — "Never use em dashes (—) anywhere in UI copy, comments, or code. Rewrite the sentence instead. En dashes (–) also disallowed in UI copy. Regular hyphens (-) are fine where natural."
- Add a one-liner to `mem://index.md` Core.

## Technical notes
- Files touched in Part 2: any file containing `—` under `src/`. I'll do this as a series of targeted edits per file (not a blind sed) so I can rephrase rather than substitute mechanically.
- Part 1 is read-mostly; the only writes are the test property row + uploaded images. I'll note them in the report so you can delete the test data if you want.
- No schema or RLS changes planned. If QA surfaces a bug that needs schema work, I'll surface it and ask before changing anything.

## Out of scope
- Tokenized flow (untouched).
- Any copy edits beyond removing em dashes.
- Visual/design changes.
