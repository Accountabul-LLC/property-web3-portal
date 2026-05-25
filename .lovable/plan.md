## Problem
The "Recent Supporters" list on a cause page shows the donor's wallet address (e.g. `rXyz…abc`). It should show the donor's name from their profile, falling back to a masked address only when no name exists.

Profiles RLS only allows users to read their own profile, so the public cause page can't directly join `campaign_donations → profiles`. We need to denormalize a display name onto the donation row at insert time.

## Changes

### 1. Database migration
Add a nullable `donor_display_name text` column to `public.campaign_donations`. No RLS change needed (existing public read policy already exposes non-anonymous escrowed donations).

### 2. Edge function `campaign-donate`
When inserting the donation row, look up the donor's profile with the service-role client and populate `donor_display_name`:
- prefer `full_name`
- else `first_name [+ last_name initial]`
- else null (UI will fall back)

Also backfill the same field in the `campaign-check-donation` recovery path (where the donation row is reconstructed/updated) so older or recovered rows get a name once available.

### 3. Hook `src/hooks/useCampaigns.ts`
Add `donor_display_name` to the `useCampaignDonations` select.

### 4. UI `src/pages/CauseDetail.tsx`
In the Recent Supporters block:
- Avatar fallback: first 2 letters of `donor_display_name` if present, else current address-based initials.
- Name line: `donor_display_name ?? shortAddress(donor_wallet_address)`.

No address is rendered when a name exists.

### Out of scope
- Backfilling historical donations (older rows just keep falling back to address). If desired we can add a one-time SQL update joining on `donor_user_id`.
- Showing avatar images (profiles.avatar_url) — can be a follow-up.
