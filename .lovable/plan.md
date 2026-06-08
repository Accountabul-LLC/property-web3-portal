## Security Audit — Exposed Secrets & Sensitive Data

Goal: Confirm the **published** site (`property-web3-portal.lovable.app`) does not expose any private keys, seed phrases, API secrets, or hardcoded credentials. The published build is the current `main` branch on GitHub (preview is ahead and not yet published), so auditing the repo's published-equivalent state covers the live site.

### Scope
- Client-side bundle only (anything in `src/`, `public/`, `index.html`, `.env` keys prefixed `VITE_`). This is what ships to browsers.
- Edge functions are server-side and not exposed publicly — out of scope unless we find a leak path.

### Audit Steps

1. **Static scan of repo for secret patterns**
   - `rg` for: `sEd`/`sEs` (XRPL seeds), `xrpl.Wallet.fromSeed`, `PRIVATE_KEY`, `SECRET`, `seed:`, `mnemonic`, `BEGIN RSA`, `BEGIN PRIVATE`, `sk_live`, `sk_test`, `ghp_`, `AIza`, `eyJhbGciOi...service_role`, `SUPABASE_SERVICE_ROLE`, hardcoded 32+ char hex strings.
   - Scope to `src/`, `public/`, `index.html`, root config files. Exclude `supabase/functions/` (server-side).

2. **Verify `.env` exposure surface**
   - Confirm only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` are referenced client-side (these are public/anon — safe by design).
   - Flag any `VITE_*` var that looks like a secret.

3. **Check for accidentally-committed wallet artifacts**
   - Search for `.json` files containing `seed`, `secret`, `master_seed`, `family_seed`.
   - Search for `.pem`, `.key`, `.p12`, `id_rsa` files in the repo.

4. **Check client code for service-role / admin key usage**
   - `rg "service_role"` across `src/` — must be zero hits.
   - Confirm no edge-function secrets are imported into frontend.

5. **Run Lovable's backend security scan**
   - `security--run_security_scan` to surface RLS gaps, exposed tables, and misconfigurations on the live backend (same DB the published site uses).

6. **Fetch the live published JS bundle (optional spot-check)**
   - Pull `https://property-web3-portal.lovable.app` HTML + one bundled JS chunk, grep the minified output for the same secret patterns to confirm nothing snuck through the build.

### Deliverable
A short report listing:
- Files/lines flagged (with severity), or "clean" per category.
- Any backend RLS/policy findings from the scan.
- Recommended fixes (if anything is found) — applied in a follow-up build-mode session, not this one.

### Out of Scope
- Edge function code review (server-only secrets).
- Auth/UX changes.
- Anything in the preview branch that isn't yet published.

Approve and I'll run the audit.
