## Goal
Make Step 1 of vendor onboarding industry-aware: pick an industry, get the credential fields that matter for it, optionally upload supporting documents. Replace the EIN-last-4 field with full EIN, add tax-exempt EIN, and let any vendor add other credentials beyond their industry defaults.

## UX flow on Step 1

1. **Industry selector** (single-select, top of form, required)
2. **Always-on tax block:**
   - Full EIN (`XX-XXXXXXX`, masked except last 4 in display after save)
   - "We are a 501(c)(3)" toggle → reveals Tax-Exempt EIN field
3. **Industry-suggested credentials section** — auto-renders the relevant credential rows for the chosen industry (e.g. real estate agent → State RE License + state, MLS Member ID, NRDS ID). Each row is optional but pre-listed so the vendor knows what counts.
4. **"Add another credential"** button → dropdown of all 30+ credential types (full catalog from research). User picks type → row appears with the right sub-fields (number, state, expiration, file upload).
5. **Document upload per credential** — optional PDF/JPG/PNG, ≤10MB, stored privately. Admin reviewers see it in the CRM.
6. Existing fields (company name, email, phone, place of business, employee count, logo, bio, advertising opt-in) stay as-is.

## Industry → suggested credentials map

| Industry | Suggested credentials |
|---|---|
| Real Estate Agent / Broker | State RE License, MLS Member ID, NRDS ID, Brokerage License |
| Mortgage / Lending | NMLS ID, State Mortgage License |
| Title & Escrow | State Title Producer License, Escrow Agent License, ALTA Membership |
| Appraisal | State Appraiser License, ASC Registry # |
| Home Inspection | State Inspector License, ASHI/InterNACHI # |
| General Contractor | State GC License, EPA RRP, OSHA card |
| Specialty Trade (Plumb/Elec/HVAC) | State Trade License, EPA RRP, OSHA |
| Property Management | State PM/RE License, CPM (IREM), NARPM ID |
| Insurance | NPN, State Producer License |
| Legal (Real Estate Attorney) | State Bar # |
| Accounting / Tax | CPA License, PTIN |
| Architecture / Engineering | NCARB / PE / PLS License |
| Notary / Signing Agent | State Notary Commission #, NNA ID |
| Government / SBA Contractor | UEI (SAM.gov), SBA 8(a)/WOSB/MBE/HUBZone/DBE |
| Green Building | LEED AP (GBCI) ID |
| Nonprofit / Housing Org | 501(c)(3) Tax-Exempt EIN (already in tax block) |
| Other | (no defaults; user picks from full catalog) |

Vendor can always add credentials outside their industry via "Add another credential."

## Data model

Schema changes (one new table + one new column + storage bucket):

1. **`vendor_profiles` additions**
   - `industry text` — slug from the list above
   - `ein_full text` — encrypted/stored full EIN (we'll keep `ein_last4` populated as a computed convenience; do not drop it yet — admin CRM reads it)
   - `tax_exempt boolean default false`
   - `tax_exempt_ein text`

2. **New `vendor_credentials` table** (one row per credential the vendor adds)

   ```text
   id uuid pk
   vendor_profile_id uuid fk -> vendor_profiles(id) on delete cascade
   user_id uuid (denormalized for RLS)
   credential_type text   -- e.g. 'nmls_id', 'state_re_license', 'ein', 'state_bar'
   credential_number text
   issuing_state text     -- nullable; required for state-issued credentials
   issuing_authority text -- free text fallback for "Other"
   expires_on date
   document_path text     -- path in storage bucket; nullable
   document_name text
   verification_status text default 'unverified'
     check in ('unverified','submitted','verified','rejected')
   notes text
   created_at, updated_at
   ```
   RLS: owner full CRUD on own rows; admins full access.
   GRANTs: authenticated (CRUD), service_role (all). No anon.

3. **New private storage bucket** `vendor-credentials` (not public). RLS:
   - Owners read/write objects under `{user_id}/...`
   - Admins read all

A static credential catalog (type → label, requires_state, requires_expiration, help URL for public verification) lives in `src/lib/vendorCredentialCatalog.ts`. No DB table for the catalog — it's reference data.

## Files

**Create**
- `src/lib/vendorCredentialCatalog.ts` — industry list, credential type definitions, industry→suggested-types map
- `src/components/vendor/CredentialRow.tsx` — single editable credential row (type, number, state, expiry, upload, delete)
- `src/components/vendor/IndustryCredentialsSection.tsx` — orchestrates suggested rows + custom rows + "Add credential" picker
- `src/hooks/useVendorCredentials.ts` — list/create/update/delete with React Query, upload helper
- `supabase/migrations/<ts>_vendor_credentials.sql` — schema + RLS + GRANTs + storage bucket + storage RLS

**Edit**
- `src/components/vendor/VendorProfileForm.tsx`
  - Add industry select at top
  - Replace `ein_last4` field with full EIN input + format mask; derive `ein_last4` on save for back-compat
  - Add tax-exempt toggle + tax-exempt EIN field
  - Mount `<IndustryCredentialsSection />` below the basic fields
- `src/hooks/useVendorProfile.ts` — type updates (`industry`, `ein_full`, `tax_exempt`, `tax_exempt_ein`)
- `src/components/admin/VendorCRMPanel.tsx` — surface industry, full EIN (masked except last 4 by default with "show" toggle for admins), tax-exempt status, and a credentials list with download links for uploaded docs

## Validation

- EIN: regex `^\d{2}-?\d{7}$`, store normalized as `XX-XXXXXXX`
- Tax-exempt EIN: same format
- Credential number: 3–40 chars, alphanumeric + dashes
- State: required when the credential type's `requires_state` is true (catalog flag)
- Expiration: optional but warned if past
- File upload: PDF/JPG/PNG/WEBP, ≤10MB
- All client-side validation via zod schema in the credential row component, mirrored by the CHECK constraints + length limits in SQL

## Out of scope (separate follow-ups)
- Automated verification API calls (NMLS lookup, NPN lookup, IRS EO search). For now status stays `unverified` → admin reviews → flips to `verified`/`rejected` in CRM.
- Industry-specific extra profile fields (e.g. service radius, license disciplines). Easy to add later by hanging an `industry_metadata jsonb` off `vendor_profiles`.
- Replacing `ein_last4` everywhere (kept for CRM display until that panel is migrated).

## Open question
Should the **industry selector** be single-select (cleaner UX, matches "what industry are you in?") or multi-select (a contractor who also does property management)? Current plan: single-select with "Other" + ability to add any credential regardless of industry, which covers the multi-discipline case without complicating the UI. Confirm or override before build.
