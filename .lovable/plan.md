## Problem

At signup we collect **Full Name** (e.g. "Jane Doe") and save it to `profiles.full_name`. The Dashboard profile, however, drives "profile complete" off `profiles.first_name` and `profiles.last_name` — which are empty after signup. So the user sees a "complete your profile" prompt asking for First Name and Last Name again, even though they just typed their name 30 seconds ago. Same story for vendors landing on `/vendor/onboarding` → Dashboard.

## Fix (minimal, low‑risk)

Split the name at the **signup** step and write all three fields so downstream screens see a complete profile.

### 1. `src/components/auth/AuthForm.tsx`

In the signup branch, before the `profiles.update(...)` call, split `fullName`:

```
const trimmed = fullName.trim().replace(/\s+/g, ' ')
const [first, ...rest] = trimmed.split(' ')
const firstName = first ?? ''
const lastName = rest.join(' ')   // may be empty for mononyms — that's fine
```

Then include them in the update payload alongside `full_name`, `account_type`, `company_name`.

### 2. `src/pages/Dashboard.tsx` — backfill safety net

For users who already signed up before this change (only `full_name` populated), auto‑hydrate the edit form and the "profile complete" check from `full_name` when `first_name` / `last_name` are missing:

- In the effect that seeds `formData` (around line 137), if `profile.first_name` is empty but `profile.full_name` is set, derive first/last from `full_name`.
- In the "incomplete profile" banner condition (line 370), treat a present `full_name` as satisfying the name requirement.

No schema change, no migration — `profiles` already has all three columns.

### 3. Out of scope (calling out, not changing)

- The user also mentioned phone — Dashboard requires `phone` for "complete profile" but signup doesn't ask for it. Leaving that alone unless you want it removed from the completeness check.
- KYC (`/kyc`) hands off directly to Stripe Identity and does **not** re‑ask for name in our UI, so nothing to change there.

## Result

A new user signs up with "Jane Doe" → lands on Dashboard → First Name "Jane", Last Name "Doe" already filled, no "complete your profile" nag, no second name prompt. Existing users see the same thing on next visit thanks to the backfill in step 2.
