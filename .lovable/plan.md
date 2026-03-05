

## Multi-Tenant Authentication and User Profiles

The project already has basic auth infrastructure (Auth page, useAuth hook, properties linked via `owner_user_id`). What's missing is: user profiles, account type tracking (business vs individual), protected routes, and visible sign-in/sign-out in the navigation.

### Plan

**1. Create `profiles` table (database migration)**
- `id` (uuid, PK, references auth.users ON DELETE CASCADE)
- `email` (text)
- `full_name` (text)
- `account_type` (text: 'individual' or 'business')
- `company_name` (text, nullable -- only for business accounts)
- `phone` (text, nullable)
- `created_at`, `updated_at`
- RLS: users can read/update their own profile; admins can read all
- Trigger: auto-create profile row on signup (via `auth.users` insert trigger)

**2. Update Auth page**
- Add account type selector (Individual / Business) on the sign-up form
- Add full name field (and company name if business is selected)
- After signup, insert profile data with account type
- Add password reset flow (forgot password link + /reset-password page)

**3. Add sign-in/sign-out to Navigation**
- Show user email/name + Sign Out button when authenticated
- Show Sign In button when not authenticated
- Link to `/auth`

**4. Protect the Tokenize page**
- Redirect unauthenticated users to `/auth` from `/tokenize`
- Show the user's existing draft properties (already queries by `owner_user_id`)

**5. Create a basic profile/dashboard page**
- `/dashboard` route showing user info, account type, and their submitted properties
- Allow editing profile details

### Files to create/modify
- **Database migration**: Create `profiles` table + auto-create trigger
- `src/pages/Auth.tsx`: Add name, account type fields to signup
- `src/pages/ResetPassword.tsx`: New page for password reset
- `src/pages/Dashboard.tsx`: New user dashboard
- `src/components/Navigation.tsx`: Add auth state UI (sign in/out)
- `src/hooks/useAuth.ts`: Optionally extend to fetch profile
- `src/App.tsx`: Add new routes (`/dashboard`, `/reset-password`)

