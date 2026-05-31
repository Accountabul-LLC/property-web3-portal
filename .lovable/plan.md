## Goal

Stop asking users for data we already have. Pull values from KYC and vendor intake into the profile, prefill the vendor intake from existing data, and show a verified badge on any field whose value matches what was confirmed by a trusted source (Stripe Identity, KYC review, OAuth). Pull the specific users profile info from any intake form for that user to fill in info that already availible to use. Users should not be able to use any other irgs info, individual info thats not associated with what they put into the fields

## Phased plan

### Phase 1 — Verification storage + Stripe Identity auto-fill (backend)

- **New table** `public.profile_field_verifications`
  - `id uuid pk`, `user_id uuid not null`, `field_name text not null`, `source text not null` (`stripe_identity` | `kyc_review` | `oauth_google` | `vendor_intake`), `verified_value text not null`, `verified_at timestamptz default now()`, `metadata jsonb default '{}'`
  - `unique (user_id, field_name)` (latest verification per field wins; updates upsert)
  - GRANTs: `select` to `authenticated`, `all` to `service_role`. No anon.
  - RLS: user reads own (`user_id = auth.uid()`), admins read all, writes are service_role-only (no policy for `authenticated` insert/update).
- **Helper RPC** `get_profile_verifications()` returns the caller's rows.
- **Wire Stripe Identity webhook / KYC approval path**: when a `kyc_case` flips to `approved`, read its latest `kyc_form_data` and upsert one row per tracked field (`first_name`, `last_name`, `date_of_birth`, `address_line1`, `address_line2`, `city`, `state`, `zip`, `country`) with `source='stripe_identity'` (or `'kyc_review'` for manual approvals). `verified_value` stores the canonical normalized form (lowercased/trimmed) we compare against.
- **Optional auto-fill into profile**: if a `profiles` field is null/empty, copy the verified value in. Never overwrite an existing user-entered value silently.

### Phase 2 — Verified badges in the profile UI

- New hook `useProfileVerifications()` — single query, cached by user id.
- New `<VerifiedBadge source="stripe_identity" />` component (shield-check icon, tooltip: "Verified by ID check on {date}"). Variants per source.
- Comparison helper `isFieldVerified(profileValue, verification)` — normalizes both sides (trim, lowercase, strip punctuation for addresses) before equality check.
- Render the badge next to each field label in `Dashboard` "Complete your profile" and the read-only profile view. When a field has a verification but the user-entered value differs, show an inline "Use verified value" button that copies the verified value into the input (no silent overwrite).
- Group display into "Verified by identity check" vs "Self-reported" sections in read-only mode.

### Phase 3 — Vendor intake shares profile data

- Prefill `VendorOnboarding` / `VendorProfileForm` from `profiles` (and `kyc_form_data` when present) so the user doesn't retype name, phone, address, DOB.
- On submit, upsert the shared fields back into `profiles` so edits in the vendor flow propagate to the profile.
- Render the same `<VerifiedBadge>` next to shared fields inside the vendor form.
- Vendor-only fields (services, bio, hourly rate, etc.) stay unique to `vendor_profiles` and never get a badge.

## Tracked fields (initial set)

`first_name`, `last_name`, `date_of_birth`, `phone` (only if KYC ever captures it; otherwise leave un-verifiable for now), `address_line1`, `address_line2`, `city`, `state`, `zip`, `country`. Email gets `source='oauth_google'` when the user signed in via Google.

## Technical notes

- All writes to `profile_field_verifications` go through edge functions running with `SUPABASE_SERVICE_ROLE_KEY` — never from the browser. This is what lets us trust `source`.
- Updating a verified field in `profiles` does NOT delete the verification row; it just stops matching, so the badge disappears until the user restores the verified value or re-verifies.
- The Stripe Identity webhook path already exists for the KYC flow; we extend it rather than adding a new function.

## Out of scope

- Phone verification (Twilio), address verification (USPS/Google Places), email-link re-verification — separate work.
- A new "business owner" account type — confirmed not needed; vendor flow covers it.
- Property tokenization intake (`/tokenize`) — not part of this round.

## Result

- Stripe-verified ID data flows into the profile automatically and is visibly marked as verified.
- Vendors no longer retype data the platform already has.
- Public profiles can credibly distinguish "verified" data from "self-reported."