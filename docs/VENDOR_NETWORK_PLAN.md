# Verified Vendor Network

## Product Goal

Build a business-profile vendor network where a user can:

1. Upgrade their profile to business
2. Maintain a vendor CRM profile
3. Request verified vendor status
4. Be reviewed and approved by admins
5. Show a verified badge wherever their business identity appears

The product ends when the workflow below is complete and stable:

- business profile data entry
- verified vendor request submission
- admin review queue
- approval / issuance / revocation
- public badge display
- admin CRM list of vendors

## Explicit Scope

### In scope

- Business profile fields for vendor CRM
- Vendor logo upload
- Business email and phone
- Place of business
- Employee count
- EIN last 4 digits
- Advertising opt-in
- Vendor bio
- Vendor verification request flow
- Admin Verified Vendors dashboard
- Vendor badge display on public marketplace cards
- Vendor status syncing between credential workflow and profile data

### Out of scope

- Payments / work-order commission automation
- Leaderboards
- Public vendor search engine
- Employee accounts per business
- Full business KYC integration with a third-party provider
- Advertising campaign tooling
- Analytics dashboards beyond basic CRM metrics

## Data Model

### `vendor_profiles`

The vendor CRM record for a business account.

Key fields:

- `user_id`
- `profile_id`
- `company_name`
- `logo_url`
- `business_email`
- `business_phone`
- `place_of_business`
- `employee_count`
- `ein_last4`
- `advertising_opt_in`
- `vendor_bio`
- `verification_status`
- `verified_at`
- `requested_at`
- `reviewed_at`
- `reviewed_by`
- `notes`

### Existing credential flow reused

- `credential_catalog.vendor`
- `credential_applications`
- `review-credential-application`
- `issue-credential`
- `revoke-credential`

The `vendor` credential is the source of truth for request/review/approval.

## UX Wireframe

### Business dashboard

1. Vendor status card
2. Vendor profile editor
3. Connected wallets
4. Existing user profile sections

### Admin dashboard

1. Admin card for `Verified Vendors`
2. Request queue with approve/reject/issue/revoke actions
3. Verified vendor list
4. CRM details for each vendor

### Public marketplace

1. Star badge for verified vendors
2. Existing marketplace cards render the badge

## Definition of Done

The feature is done when:

- a business profile can save vendor CRM details
- a vendor can request verification
- an admin can review the request
- approval updates the vendor record and badge status
- revocation removes the verified state
- the admin can browse a verified vendor list
- the public marketplace shows the verified badge consistently
- the build passes

## Hard Stop

Do not add:

- employee management
- work-order billing automation
- ad marketplace tools
- extra network tiers
- leaderboard mechanics
- unrelated business products

If a future request needs those, treat them as a separate phase.
