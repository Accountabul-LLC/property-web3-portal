
# Vendor Features Security & Fuzz Test Plan

Scope: the recently added vendor surfaces (`vendor_profiles`, `vendor_products`, `vendor_leads`, `vendor_credentials`, public profile route, "My Public Profile" nav, heart/save retarget). Goal: confirm no PII leaks, RLS holds, edge cases don't crash, and inputs can't be abused.

## 1. Read-only DB recon (no mutations)

Run a `supabase--linter` pass and targeted `supabase--read_query` checks:

- Confirm RLS is **enabled** on every vendor table (`vendor_profiles`, `vendor_products`, `vendor_leads`, `vendor_credentials`, plus any `vendor_*` table I find).
- Dump all RLS policies for those tables and verify:
  - Public `SELECT` is scoped to `verification_status = 'verified' AND public_profile_enabled = true` (or equivalent), never `USING (true)` over the full row.
  - Sensitive columns (lead emails/phones, internal notes, credential file paths, business_email if private, owner `user_id`) are either filtered by policy or moved behind a public view.
  - `INSERT/UPDATE/DELETE` policies all scope to `auth.uid() = owner_user_id` (or analogous).
  - `vendor_leads` is **owner-only read** — public/anon must not be able to list leads.
  - `vendor_credentials` storage paths in `vendor-credentials` bucket are private (bucket already non-public ✓) and DB rows are owner-only.
- Confirm GRANTs match policies (no stray `GRANT SELECT ... TO anon` on lead/credential tables).
- Check for any public view that re-exposes columns the base table hides.

## 2. Anonymous (anon key) fuzz

Using a script with only the anon key + Supabase REST, attempt:

- `SELECT *` on each vendor table → expect only public-safe rows/columns on `vendor_profiles` + published `vendor_products`; empty/forbidden on `vendor_leads`, `vendor_credentials`, draft/unverified profiles.
- Insert a lead with random payloads (XSS strings, 10KB blobs, null bytes, SQL-ish strings, unicode, emoji, very long email) into `vendor_leads` for a real verified vendor — verify server-side validation (length caps, email format, required fields) and that it doesn't crash the UI when rendered.
- Insert vendor_profile / vendor_product as anon → expect denied.
- Try to read another user's draft profile by slug guessing → expect denied.

## 3. Authenticated-but-not-owner fuzz

Sign in as a second test user and attempt against a vendor owned by user A:

- UPDATE/DELETE `vendor_profiles`, `vendor_products`, `vendor_credentials` of user A → expect denied.
- Read `vendor_leads` of user A → expect denied.
- Toggle `public_profile_enabled` / `verification_status` on user A's profile → expect denied (verification must be admin/server-only).
- Insert a `vendor_product` with `vendor_profile_id` belonging to user A → expect denied by WITH CHECK.

## 4. Owner edge cases

As the owner:

- Create profile with empty/whitespace company name, 5KB bio, malicious `<script>` in headline/bio, javascript: URLs in `website_url`, broken image URL in logo, non-https website → confirm UI sanitizes and DB constraints/length caps hold.
- Product with `price_cents` = negative, 0, null, `Number.MAX_SAFE_INTEGER`, non-USD currency string ("'; drop"), 50MB image URL.
- Slug collisions, slug with spaces / unicode / very long.
- Toggle `is_published` rapidly; soft-delete behavior.

## 5. Public profile route + nav

- `/vendor/:slug` for: unknown slug, draft vendor, unverified vendor, profile with `public_profile_enabled = false`, profile with all-null fields, profile with XSS-laden fields → expect 404 / "not available" and no crash, no script execution.
- "My Public Profile" nav link: signed-out, signed-in non-vendor, signed-in vendor with no slug, vendor with `public_profile_enabled = false`, vendor pending verification → link should hide or route to onboarding, never to a broken page.
- Heart/save button on public vendor page: confirms it routes to saved properties dashboard for signed-in user and prompts auth for anon (per the last change).

## 6. Edge functions (if any vendor functions exist)

For each vendor-related edge function found (e.g. lead submission, vendor admin actions):

- Call without JWT, with expired JWT, with another user's JWT → expect 401/403.
- Send malformed JSON, missing fields, oversized body (>1MB), wrong content-type → expect clean 400, not 500.
- Check logs via `supabase--edge_function_logs` for stack traces leaking internals.

## 7. Deliverable

A single markdown report at `/mnt/documents/vendor-security-fuzz-report.md` with:

- One row per check: target, method, expected, actual, **PASS / FAIL / WARN**.
- For each FAIL: severity + recommended fix (RLS policy change, GRANT revoke, server-side validation, view to hide column, etc.).
- A short "fix queue" section ranked by severity.

No code or schema changes will be made in this pass — findings only. If FAILs are found, I'll propose a follow-up migration/code plan for your approval.

## Technical notes

- Uses `supabase--read_query`, `supabase--linter`, `supabase--edge_function_logs` for inspection.
- Uses `code--exec` with a Node/Deno script + the public anon key and two test Supabase sessions for the anon and cross-user fuzz.
- Test data is written only to a dedicated throwaway vendor record; cleanup queries listed at the end of the report.
- No service-role key used; no destructive SQL run.
