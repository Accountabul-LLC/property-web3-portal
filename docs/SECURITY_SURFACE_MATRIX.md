# Security Surface Matrix

This doc turns the product rule into an operational policy:

- The browser can collect intent.
- The server must decide, sign, create, persist, and reconcile.
- Anything that touches secrets, service-role access, payments state, provider calls, or admin/compliance state should not be trusted from the client.

Legend:

- `public` = visible/callable without authentication
- `authenticated` = requires a valid Supabase session or user-owned proof
- `admin-only` = requires admin/compliance role checks
- `authenticated + role check` = requires a valid session plus an admin/compliance/operator role check
- `cron-only` = intended for scheduled or operator execution only
- `webhook-only` = intended for third-party signed callbacks only
- `public read-only` = callable by anyone, but must never mutate private state

## App Routes

| Route | Bucket | Notes |
| --- | --- | --- |
| `/` | `public` | Marketing/homepage. |
| `/auth` | `public` | Sign-in and sign-up entry point. |
| `/reset-password` | `public` | Email-based recovery flow. |
| `/marketplace` | `public` | Public discovery page. |
| `/professionals` | `public` | Public discovery page. |
| `/pricing` | `public` | Public product/pricing page. |
| `/payments` | `public` | Public storefront page; actual checkout is gated in-page by auth/KYC. |
| `/payments/history` | `authenticated` | Account-specific history. |
| `/payments/:id` | `authenticated` | Account-specific detail view. |
| `/portfolio` | `authenticated` | Page is a signed-in account surface. |
| `/dashboard` | `authenticated` | Account dashboard. |
| `/settings` | `authenticated` | Personal settings and operator entry points. |
| `/kyc` | `authenticated` | Identity verification flow. |
| `/kyc/status` | `authenticated` | Private verification status. |
| `/credentials` | `authenticated` | User credential surface. |
| `/causes` | `public` | Public causes discovery. |
| `/causes/:slug` | `public read-only` | Public campaign detail; donations/actions are gated separately. |
| `/causes/apply` | `authenticated` | Application flow. |
| `/causes/my-donations` | `authenticated` | Personal donation history. |
| `/smart-escrow` | `public` | Public product page. |
| `/escrow` | `public` | Redirects to `/smart-escrow`. |
| `/treasury` | `public` | Public-facing treasury page for now; if it starts showing sensitive balances, move it to `authenticated` or `admin-only`. |
| `/protection/deed-fraud` | `public` | Public education/support page. |
| `/property/:id` | `public read-only` | Public listing surface; user actions may still be gated in-page. |
| `/tokenize` | `admin-only` | Route guard already enforces admin plus KYC. |
| `/mint` | `admin-only` | Route guard already enforces admin plus KYC. |
| `/swap` | `admin-only` | Route guard already enforces admin. |
| `/pools` | `admin-only` | Route guard already enforces admin. |
| `/ai-agents` | `admin-only` | Route guard already enforces admin. |
| `/action-items` | `admin-only` | Operator workflow; keep admin-only if it exposes edit/mutation actions. |
| `/admin` | `admin-only` | Admin landing page. |
| `/admin/kyc` | `admin-only` | KYC review surface. |
| `/admin/ai-panel` | `admin-only` | Internal AI/operator tooling. |
| `/admin/credentials` | `admin-only` | Credential review and issuance. |
| `/admin/payments` | `admin-only` | Payments ledger. |
| `/admin/payments/console` | `admin-only` | Developer console. |
| `/admin/users` | `admin-only` | Admin redirect/surface. |
| `/admin/causes` | `admin-only` | Cause moderation and release controls. |
| `/admin/pricing` | `admin-only` | Membership/pricing editor. |

## Edge Functions

### Public read-only

| Function | Bucket | Notes |
| --- | --- | --- |
| `xrp-price` | `public read-only` | Market price lookup only. |
| `xrpl-account-data` | `public read-only` | Ledger read path with caching; never mutate. |
| `xrpl-token-search` | `public read-only` | Token discovery lookup. |
| `xrpl-token-meta` | `public read-only` | Token metadata lookup. |
| `places-autocomplete` | `public read-only` | Google Places lookup; no private state. |
| `places-details` | `public read-only` | Google Places lookup; no private state. |

### Authenticated user-owned actions

| Function | Bucket | Notes |
| --- | --- | --- |
| `payments-create` | `authenticated` | Requires Supabase JWT and KYC approval; creates payment/invoice state. |
| `payments-list` | `authenticated` | User-owned reads; admin scope still requires admin role. |
| `payments-get` | `authenticated` | User-owned reads; admin scope still requires admin role. |
| `xaman-create-payload` | `authenticated` | Must only create payloads for the signed-in caller. |
| `xaman-check-payload` | `authenticated` | Must verify the caller owns the payload/session. |
| `xaman-send-payment` | `authenticated` | Must verify session and wallet ownership before creating a wallet request. |
| `xrpl-build-payment` | `authenticated` | Builds a signable payment request. |
| `xrpl-build-token-payment` | `authenticated` | Builds a signable token transfer. |
| `xrpl-build-swap` | `authenticated` | Builds a signable swap transaction. |
| `xrpl-build-mint` | `authenticated` | Builds a signable mint transaction. |
| `xrpl-submit-signed` | `authenticated` | Submits a signed payload on behalf of the caller. |
| `xrpl-sponsor-trustline` | `authenticated` | Wallet-owned trustline sponsorship. |
| `wallet-register` | `authenticated` | Registers a wallet for the signed-in user. |
| `wallet-audit-log` | `authenticated` | User-owned audit log access. |
| `credential-accept` | `authenticated` | User accepts a credential payload. |
| `check-credential` | `authenticated` | Credential status read/check tied to caller. |
| `check-credential-payload` | `authenticated` | Payload status tied to caller. |
| `apply-for-credential` | `authenticated` | User application path. |
| `evaluate-credential-eligibility` | `authenticated` | User eligibility evaluation. |
| `stripe-identity-create-session` | `authenticated` | Creates a Stripe Identity session for the signed-in user. |
| `kyc-start` | `authenticated` | Starts KYC for the caller. |
| `kyc-save` | `authenticated` | Persists KYC drafts/results for the caller. |
| `kyc-submit` | `authenticated` | Submits the caller's KYC application. |
| `compliance-check` | `authenticated` | User-owned compliance check. |
| `campaign-submit` | `authenticated` | User submits a cause application. |
| `campaign-donate` | `authenticated` | Requires wallet ownership and network matching. |
| `campaign-check-donation` | `authenticated` | Checks a user donation payload/status. |
| `auto-issue-credential` | `authenticated` | Automation-assisted issuance path; keep it off the public browser path. |

### Authenticated + role check

| Function | Bucket | Notes |
| --- | --- | --- |
| `wallet-approve` | `authenticated + role check` | Must verify caller and role before approving wallet or credential state. |
| `issue-credential` | `authenticated + role check` | Issue path must be role-gated. |
| `revoke-credential` | `authenticated + role check` | Revoke path must be role-gated. |
| `issue-testnet-credential` | `authenticated + role check` | Testnet issuance must be role-gated. |

### Admin-only

| Function | Bucket | Notes |
| --- | --- | --- |
| `admin-wallet-registrations` | `admin-only` | Admin review queue. |
| `admin-credential-applications` | `admin-only` | Admin review queue. |
| `admin-credential-ledger` | `admin-only` | Admin credential ledger. |
| `admin-integrations` | `admin-only` | Admin integration manager. |
| `action-item-admin` | `admin-only` | Operator/action-item controls. |
| `campaign-admin` | `admin-only` | Admin cause moderation and mutation. |
| `campaign-release` | `admin-only` | Manual admin release path. |
| `get-issuer-status` | `admin-only` | Issuer wallet state. |
| `issuer-wallet-register` | `admin-only` | Issuer wallet registration. |
| `review-credential-application` | `admin-only` | Admin credential review. |
| `admin-reveal-signer` | `admin-only` | Secret-bearing admin utility. |
| `admin-fund-signer` | `admin-only` | Secret-bearing admin utility. |
| `github-agent` | `admin-only` | Admin/operator GitHub helper. |
| `tokenization-pipeline` | `admin-only` | Admin pipeline execution and updates. |
| `ai-debate` | `admin-only` | Explicitly admin-gated orchestration surface. |

### Webhook-only

| Function | Bucket | Notes |
| --- | --- | --- |
| `payments-webhook` | `webhook-only` | Stripe signature for Stripe events; shared secret for non-Stripe event ingestion. |
| `stripe-identity-webhook` | `webhook-only` | Stripe signature verification required. |

### Cron-only / operator-only

| Function | Bucket | Notes |
| --- | --- | --- |
| `payments-reconcile` | `cron-only` | Reconciliation job; should not be browser callable. |
| `campaign-release-due` | `cron-only` | Scheduled escrow release job. |

## Payments-Specific Policy

Keep this split:

- Public UI:
  - `/payments`
  - draft previews
  - sign-in / KYC prompts
- Server-side only:
  - payment creation
  - Stripe intent creation
  - XRPL handoff creation
  - invoice/provider persistence
  - reconciliation
  - webhook ingestion
- Client-side only:
  - draft form state
  - local validation
  - navigation to auth/KYC

## Hard Rules

- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `XAMAN_API_SECRET`, or reconciliation secrets to the client.
- Do not trust `origin` as an authorization mechanism.
- Do not let anonymous callers create, mutate, or reconcile payment state.
- Do not let the browser directly call provider APIs when the server can own that contract.
- If a route is public, that does not mean its actions are public.
