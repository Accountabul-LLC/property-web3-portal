## Goal

Turn the Vendor Onboarding page into an accordion where each step is independently clickable, only one step is expanded at a time, and saving/completing a step automatically collapses it and expands the next incomplete step — so users can actually reach Step 3 (Vendor Membership).

## Changes

### 1. `src/pages/VendorOnboarding.tsx` — accordion behavior

- Add `expandedStep` state (string key: `'profile' | 'kyc' | 'payment' | null`).
- Initial value: the first step whose status is not `'done'` (so a returning user lands on whatever they haven't finished). If everything is done, `null`.
- Each step `Card` becomes clickable: clicking the header toggles `expandedStep` (collapse if already open, otherwise open that step and close others).
- Only render `step.body` and `step.cta` when `expandedStep === step.key`. The header (icon, title, status badge, chevron) is always visible.
- Add a chevron indicator (lucide `ChevronDown` / `ChevronUp`) on the right side of each header.
- Completed steps still collapse but remain clickable so users can re-open and review/edit.

### 2. Auto-advance after Step 1 save

- Add an optional `onSaved?: () => void` prop to `VendorProfileForm`.
- Call it after `saveVendorProfile` succeeds (right after the success toast in the form).
- In `VendorOnboarding`, pass `onSaved={() => setExpandedStep(nextIncompleteStep)}` where `nextIncompleteStep` is computed from the current statuses (preferring `kyc` if not done, then `payment`, else `null`).

### 3. Step 3 (Vendor Membership) is already wired

The `payment` step already has a CTA that navigates to `/pricing` when a vendor tier exists. Making it reachable via the accordion (point 1) is what unblocks it. No route or data changes needed.

If `vendorTier` is missing (tier not yet seeded), keep the existing "tier being finalized" copy — but the step is still expandable so the user sees that message instead of being stuck.

### 4. Small UX polish

- When `expandedStep` changes via auto-advance, smooth-scroll the newly opened card into view (`element.scrollIntoView({ behavior: 'smooth', block: 'start' })`).
- Keep the existing "All steps complete" success card behavior unchanged.

## Out of scope

- No changes to KYC flow, `/pricing` page, membership tiers, or database schema.
- No changes to `VendorCRMPanel` or credential logic.
