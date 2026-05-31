## Root causes (what's actually broken)

1. **`useProfile` is local React state, not shared.** Every component calling `useProfile()` keeps its *own* copy. When Dashboard saves "Switch to Business", only Dashboard's copy updates — the vendor pages, header badge, and onboarding flow keep reading their stale local state. This is the single biggest source of the "switched but UI didn't change" + "doesn't recognize business account" complaints.
2. **No global "account state" hook.** Vendor/business/KYC checks are re-derived ad-hoc on each page from a mix of `profile.account_type`, `vendorProfile`, `kyc_cases`, etc. There is no single source of truth.
3. **`profiles.account_type` is the only business signal.** No `business_profiles` table is involved in the read path, so as long as `account_type='business'` writes, downstream checks work — *if they actually re-read*.
4. **Stripe Identity returns "Invalid API Key".** The `STRIPE_SECRET_KEY` secret currently holds a value starting with `mk_` — that's not a Stripe secret key (must be `sk_test_…` or `sk_live_…`, or `rk_…` with Identity write scope). Code is fine; secret value is wrong.
5. **No global "Back to Dashboard" affordance** on protected sub-routes (KYC, Vendor, Settings). Header has a small `LayoutDashboard` icon button at xl+ but it's easy to miss and hidden below xl.
6. **Legal-name fields are freely editable** on the Dashboard profile form with no separation from "general profile" fields.
7. **No `username` field** exists on `profiles`.

## Fix plan (in this order)

### Phase 1 — Source of truth (unblocks #2, #3, #7 user issues)

Migrate `useProfile` to **React Query** so every consumer shares one cached `profile` object.

- Rewrite `src/hooks/useProfile.ts` to use `useQuery(['profile', userId])` and an `useMutation` for updates that calls `qc.invalidateQueries(['profile', userId])` on success. Keep the same return shape (`{ profile, loading, updateProfile }`) so no callers break.
- Add a derived helper `useAccountState()` (new file `src/hooks/useAccountState.ts`) that consolidates: `isBusiness`, `isIndividual`, `isKycApproved`, `vendorStatus`, `isVendorActive`. All UI checks (vendor onboarding gate, dashboard badge, navigation hints) read from this.
- Update `src/hooks/useVendorApplication.ts` so its `canApply` check uses the React-Query-backed profile (it already calls `useProfile`, so the rewrite is transparent).

Result: clicking "Switch to Business" in Dashboard → mutation succeeds → query invalidates → vendor page, header, onboarding flow all re-render with `isBusiness=true` immediately.

### Phase 2 — Global "Dashboard" button in header

- In `src/components/Navigation.tsx`, promote the existing `LayoutDashboard` icon-only button to show on **all breakpoints** (currently only `hidden` desktop column at lg+). Add a labeled "Dashboard" button visible on mobile/tablet strip too, placed next to the wallet selector.
- Make it active-state aware so it visually highlights on `/dashboard`.

### Phase 3 — Stripe Identity key (blocker, external action required)

- I'll trigger the secrets update flow for `STRIPE_SECRET_KEY` right now. You paste a valid `sk_test_…` (test mode) or `sk_live_…` (live) key from Stripe → Developers → API keys. Stripe Identity must be enabled on that account.
- No code change needed; the edge function already reads `Deno.env.get('STRIPE_SECRET_KEY')`.

### Phase 4 — Legal identity field protection

In `src/pages/Dashboard.tsx` profile-edit form:

- Visually split the form into two sections: **"Profile"** (phone, gender, address, avatar, **username**, account type, company name) and **"Legal identity"** (first name, last name, date of birth).
- Make Legal identity fields **read-only once `kyc_status === 'approved'`** with a small note: "Locked after identity verification. Contact support to change."
- Pre-KYC they remain editable (still need them for KYC submission).

### Phase 5 — Username support

- Migration: add `profiles.username text unique`, with a check constraint `username ~ '^[a-zA-Z0-9_]{3,30}$'`. No backfill required (nullable).
- Dashboard "Profile" section gets a Username input with live availability check (debounced query against `profiles` filtered by `username`).
- `displayName` in Dashboard prefers `username` when present, then full name.

### Phase 6 — Signup audit (issue #4 in your list)

Read `src/pages/Auth.tsx`: signup *does* collect account type and writes `account_type` + `company_name` correctly. The reason a "business signup looked individual" is almost certainly Phase 1 (stale local state). After Phase 1 ships, re-test before changing signup logic. If it still misbehaves, also split `full_name` into `first_name`/`last_name` here like we did in `AuthForm.tsx`.

## Out of scope for this pass

- Building a separate `business_profiles` table. `profiles.account_type` + `company_name` already does the job; introducing another table would multiply the source-of-truth problem instead of solving it.
- A formal "request identity change" workflow for locked legal fields — out of scope; for now they're just visually locked post-KYC with a support-contact note.
- Reworking vendor approval state machine.

## Files I will touch

- `src/hooks/useProfile.ts` (rewrite to React Query)
- `src/hooks/useAccountState.ts` (new)
- `src/components/Navigation.tsx` (Dashboard button on all breakpoints)
- `src/pages/Dashboard.tsx` (form split, username input, locked legal fields, use new hook)
- `src/pages/Auth.tsx` (split full_name on signup)
- New migration: add `profiles.username` unique + check constraint
- Trigger `update_secret` for `STRIPE_SECRET_KEY`

After Phase 1 ships I'll ask you to re-test "Switch to Business" before I move on, since most of the other complaints likely dissolve once the cache invalidation works.
