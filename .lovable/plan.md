# Remove Duplicate Vendor Flow

You're right — last turn I added a parallel `/vendors/join` intake form and an "Intake Leads" admin tab on top of the existing vendor signup. That split the flow in two. This plan reverts that duplication and leaves a single, simple vendor path.

## The duplication

| Concept | Existing (keep) | Duplicate (remove) |
|---|---|---|
| Apply / signup | `/auth/vendor` → `/vendor/onboarding` | `/vendors/join` |
| Vendor record | `vendor_profiles` (account-tied) | `vendor_leads` intake rows (no account) |
| Admin review | Vendors panel in `/admin/vendors` | "Intake Leads" tab |
| Footer link | "Verified Vendors" | "Join the Vendor Network" |
| Directory CTAs | "Apply as a vendor" → `/auth/vendor` | "Join the Network" → `/vendors/join` |

`/vendor/dashboard` and `/vendor/status` only appear once — the others (`/vendors/dashboard`, `/vendors/status`, `/vendors/apply`) are pure redirects and stay so old links don't 404.

## Single canonical flow (after cleanup)

```
/vendors (directory)
   └─ "Apply as a vendor" → /auth/vendor (sign up / log in)
                              └─ /vendor/onboarding (the one application form)
                                    └─ /vendor/dashboard (status + management)
```

Admin sees every vendor — applied, under review, approved — in the existing Vendors panel at `/admin/vendors`. No second list.

## Changes

**Delete**
- `src/pages/VendorJoin.tsx`
- `src/components/admin/VendorIntakeLeadsPanel.tsx`
- `src/hooks/useVendorIntakeLeads.ts`

**Edit**
- `src/App.tsx` — remove `VendorJoin` import + `/vendors/join` route; keep the legacy redirects.
- `src/pages/AdminVendors.tsx` — drop the Tabs wrapper, render `VendorCRMPanel` directly, restore the original heading copy.
- `src/pages/VendorsDirectory.tsx` — remove the "Join the Network" CTA block; keep the single "Apply as a vendor" link to `/auth/vendor`.
- `src/components/Footer.tsx` — remove the "Join the Vendor Network" link.

**Database** — new migration that reverses the prior `vendor_leads` extension:
- Drop the columns added last turn: `business_name`, `city_service_area`, `occupation`, `licensed_status`, `best_time_to_contact`, `serves_real_estate`, `service_description`, `internal_notes`, `follow_up_date`, `assigned_admin_id`.
- Drop the `anon`/`authenticated` INSERT policy for `source = 'intake_join'`.
- Delete any rows where `source = 'intake_join'` (intake submissions made in the last day, if any).
- Restore `vendor_profile_id` and `message` to `NOT NULL` (after the delete above, the table is back to customer-inquiry rows only, which always have both).

## Out of scope

- The customer → vendor inquiry feature that originally used `vendor_leads` (different feature, untouched).
- Any change to the actual `/vendor/onboarding` form or `/vendor/dashboard` page.

## Confirm before I run it

The migration deletes intake submissions captured at `/vendors/join` since yesterday. Say the word if you'd like me to export them to CSV first, otherwise I'll proceed as written.
