## Goal

1. Block public access to **Tokenize, AI Agents, Swap, Liquidity Pools** — visitors can still see them in the hamburger menu, but opening them redirects to `/auth` unless logged in.
2. Confirm the site is safe to publish: every new sign-up (email or Google) creates an independent account — no one can land in your account.

---

## Part 1 — Lock down the pages

We already have a working `RouteGuard` component (`src/components/RouteGuard.tsx`) that handles auth/wallet/credential gating with a loading spinner and a clean redirect to `/auth`. We'll reuse it instead of writing one-off checks in each page.

**Edit `src/App.tsx`** — wrap four routes:

```tsx
<Route path="/tokenize" element={
  <RouteGuard><KycGate><Tokenize /></KycGate></RouteGuard>
} />
<Route path="/ai-agents" element={
  <RouteGuard><AIAgents /></RouteGuard>
} />
<Route path="/swap" element={
  <RouteGuard><Swap /></RouteGuard>
} />
<Route path="/pools" element={
  <RouteGuard><Pools /></RouteGuard>
} />
```

Behavior:
- Not logged in → redirected to `/auth`.
- Logged in → page loads normally (KYC gate still applies on `/tokenize` as today).
- Menu links remain visible to everyone (no nav changes).

Notes:
- `Mint` is already auth-gated inside the page; we can leave it or also wrap it with `RouteGuard` for consistency (recommend wrapping).
- The inline `useAuth` redirect inside `Tokenize.tsx` becomes redundant once wrapped — can be removed in a small cleanup.

---

## Part 2 — Public-launch auth sanity check

Your concern: "if someone signs in through Google, it doesn't sign into my account."

Good news — this is already handled correctly:

- **Google sign-in** uses Lovable's managed OAuth (`lovable.auth.signInWithOAuth("google", …)` in `src/pages/Auth.tsx`). Each Google account creates its own `auth.users` row keyed by that Google email. There is no shared session — your account is tied to *your* Google email only.
- **Email/password sign-up** uses `supabase.auth.signUp`, which also creates a fresh `auth.users` row per email.
- Sessions are stored per-browser in localStorage via the Supabase client. Another person signing in on their own device gets their own JWT; they cannot reach your data.
- RLS policies on user-owned tables (`profiles`, `user_wallets`, `kyc_cases`, etc.) already scope rows by `auth.uid()`, so even if someone signed in, they only see their own data.

**Recommended pre-launch hardening** (small, low-risk):

1. **Email confirmation ON** — verify in Cloud → Users → Auth Settings that "Auto-confirm email" is **disabled** so new users must click the verification link before signing in. (Currently the signup flow already shows "Check your email to verify your account," which implies it's off — we'll just confirm.)
2. **Leaked-password protection (HIBP)** — enable via `configure_auth` so weak/compromised passwords are rejected at sign-up.
3. **Run the Supabase linter** once to flag any RLS gaps before publish.

These three are quick toggles, not code changes. I'll run them as part of the implementation pass.

---

## Files touched

- `src/App.tsx` — wrap 4 (or 5 incl. Mint) routes with `<RouteGuard>`.
- `src/pages/Tokenize.tsx` *(optional cleanup)* — remove now-redundant inline auth redirect.
- No DB migrations, no nav changes, no new components.

## Out of scope

- Changing what's visible in the hamburger menu (you explicitly want it to stay visible).
- Wallet/KYC/credential gating beyond what each page already enforces.
- Any change to RLS policies (already correct).
