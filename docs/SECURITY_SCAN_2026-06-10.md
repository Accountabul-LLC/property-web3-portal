# Security Scan — 2026-06-10

Full-repo security scan covering all ~60 Supabase edge functions, the complete migration
history (final effective RLS state as of `20260608174637`), the frontend (`src/`), and a
repo-wide secrets sweep (working tree + git history). Follow-up to the 2026-05-21 audit.

## Verdict

**No Critical findings. Overall posture: strong.** The 2026-05-21 security fixes are intact
with no regressions. Top findings below are Medium severity hardening items.

## Status of previously known issues

| Known issue | Status |
|---|---|
| C1: plaintext `wallet_secret` in `user_wallets` | **RESOLVED** — column dropped (`20260521001000`), residual REVOKE added (`20260521100318`). Testnet seeds now live only in browser `sessionStorage`. The "Gotchas" entry in ROSETTA.md was stale. |
| Open RLS on `xaman_payloads`, `wallet_*` tables | **RESOLVED** — fixed in `20260521000000` / `20260521110000`; no later migration regressed them. |
| CORS wildcard | **RESOLVED** — all functions use origin allowlist (`APP_ALLOWED_ORIGIN` + `*.lovable.app` / `*.lovableproject.com`). |
| Stripe webhook dev fallback | **RESOLVED** — signature verification required, returns 401 on invalid signature, 500 if misconfigured. |
| Faucet anonymous access | **RESOLVED** — JWT auth check present. |

## Findings

### Medium

1. **`payments-webhook` generic path uses static shared-secret header, not HMAC**
   (`supabase/functions/payments-webhook/index.ts:138-142`).
   The Stripe path verifies signatures correctly. The generic provider path compares
   `x-payments-webhook-secret` to `PAYMENTS_WEBHOOK_SECRET` with `!==`. It correctly
   rejects when the env var is unset, but: no replay protection, secret transits in a
   plain header on every call, and the comparison is not constant-time.
   *Fix:* HMAC-sign the body with a timestamp (Stripe-style) or at minimum use a
   constant-time comparison and rotate the secret.

2. **Error responses leak internals across many functions** — raw `error.message`
   returned to clients (e.g. `campaign-check-donation:426`, `kyc-admin-review:167`,
   `xrpl-testnet-faucet:97`), and `issue-credential/index.ts:219` returns the issuer
   secret **env var name** in its error body.
   *Fix:* return generic messages; log details server-side only.

3. **Admin routes lack a route-level guard in `App.tsx`** — `/admin/*` routes rely on
   each page internally calling `useTeamAccess()` instead of a shared `<RouteGuard adminOnly>`
   wrapper. Server-side enforcement (edge functions + RLS) is in place, so this is
   defense-in-depth consistency, not an exposure.

### Low

4. **No rate limiting** on `xrpl-testnet-faucet` and `payments-create` (authenticated
   users can spam; testnet-fund exhaustion / event-table flooding).
5. **CORS allows any `*.lovable.app` / `*.lovableproject.com` subdomain**
   (`_shared/cors.ts`). Auth is Bearer-header based (not cookies), so cross-site reads of
   another user's data aren't possible; tighten to exact origins before mainnet anyway.
6. **`.env` (Supabase anon key only) was committed once in history** (`ac331cd`, 2026-05-29).
   Anon key is public by design; `.gitignore` now covers `.env*`. Optional: scrub history,
   add `.env.example`.
7. **Testnet faucet seeds in `sessionStorage`** (`ActiveWalletContext.tsx`) — intentional,
   testnet-only, session-scoped, cleared on logout/inactivity. Acceptable; never extend to
   mainnet wallets.
8. **`tokenization-pipeline` queries `user_roles` directly** instead of the `has_role` RPC
   used elsewhere — consistency item.
9. **Stale generated types**: `types.ts` still declares `wallet_secret` though the column
   was dropped. Regenerate via Lovable.

### Clean

- **Secrets sweep:** no service-role keys, Stripe secrets, XRPL seeds, API keys, or private
  keys anywhere in the working tree or history. All secrets are env-var references.
- **RLS final state:** all sensitive tables RLS-enabled and correctly scoped (user-own +
  admin/compliance); `user_roles` has no privilege-escalation path; all SECURITY DEFINER
  functions pin `search_path`; campaign/donation mutations are service-role only; storage
  buckets scoped to per-user folders; `vendor_public_profiles` view gated to verified vendors.
- **Frontend:** no XSS sinks with user input, no XRPL SDK in the browser, no open redirects
  (recent login-redirect change uses `location.state`, not query params), no postMessage
  handlers, wallet reads go through the `user_wallets_safe` view.
- **Edge functions:** 30+ functions verified to follow the auth pattern (JWT → role check →
  ownership check) correctly, including all admin-*, kyc-*, wallet-*, credential, and
  Xaman/XRPL functions.

## Recommended before mainnet

1. Replace `payments-webhook` shared-secret with HMAC + timestamp.
2. Sweep all functions for raw `error.message` responses.
3. Add `<RouteGuard adminOnly>` to `/admin/*` routes.
4. Add per-user rate limits to faucet and payment-creation endpoints.
5. Pin CORS to exact production origins; confirm `APP_ALLOWED_ORIGIN` is set.
6. Regenerate Supabase types to drop the phantom `wallet_secret` field.
