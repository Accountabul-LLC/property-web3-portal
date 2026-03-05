

## Plan: Auto-populate Profile from Google Sign-in Data

### What the user wants
When a user signs up or logs in via Google, their profile fields (name, email, etc.) should be automatically filled from the Google account data. If fields are still empty, show a gentle prompt encouraging the user to complete their profile.

### How it works today
- The `handle_new_user` database trigger creates a profile row with only `id` and `email` on signup
- The Auth page manually updates `full_name` and `account_type` after email/password signup, but does nothing special for Google OAuth
- The Dashboard form loads from the `profiles` table -- if fields are empty, they stay empty

### Changes

**1. Update `handle_new_user` trigger (database migration)**
Modify the trigger function to extract `full_name` (and split into `first_name` / `last_name`) from `raw_user_meta_data` that Google OAuth provides. Google populates `full_name`, `given_name`, `family_name`, and `avatar_url` in the user metadata automatically.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'given_name',
    NEW.raw_user_meta_data->>'family_name'
  );
  RETURN NEW;
END;
$$;
```

**2. Backfill on login for existing users (`useProfile.ts`)**
Add logic in the `fetchProfile` hook: after fetching the profile, if `first_name` is null but `user.user_metadata` has `given_name`, auto-update the profile row. This handles users who signed up via Google before this change.

**3. Add "Complete your profile" prompt (`Dashboard.tsx`)**
When the profile loads and key fields are missing (e.g., `first_name`, `phone`), show a subtle banner at the top of the profile card: "Complete your profile to unlock all features" with a button that activates edit mode. This is non-blocking and optional.

### Files to modify
- **Database migration** -- update `handle_new_user()` to extract Google metadata
- **`src/hooks/useProfile.ts`** -- add backfill logic for existing Google users on profile fetch
- **`src/pages/Dashboard.tsx`** -- add a "complete your profile" prompt when fields are empty

### No new API keys or secrets needed
Google OAuth already provides user metadata through the existing managed authentication flow.

