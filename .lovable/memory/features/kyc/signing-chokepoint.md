---
name: KYC signing chokepoint
description: All transaction-signing edge functions must call requireKyc(user.id) from _shared/require-kyc.ts. UI uses useKycGate hook.
type: feature
---
Hard rule: every edge function that signs or submits a transaction (xaman-send-payment, campaign-donate, credential-accept, xrpl-submit-signed, and any future signer) MUST call `requireKyc(user.id, corsHeaders)` immediately after `requireEdgeUser`. Returns 403 with `{ code: 'kyc_required', kyc_status }` for non-approved non-admin users. Admins bypass via `has_role`.

Only exception: `xaman-create-payload` for SignIn-only wallet-link payloads stays open (users need to connect a wallet before completing KYC).

UI side: every signing call site uses `useKycGate()` from `@/hooks/useKycGate`:
- Call `await gate.guard()` before invoking the edge function (fast UX, prevents wallet popup opening).
- Call `gate.handleEdgeResponse(data, error)` after `supabase.functions.invoke(...)` to catch server-side 403 and redirect.
- Call `gate.handleThrown(err)` in catch blocks for `fetch`-based callers (uses `kycErrorFromEdgeResponse`).

`KycRequiredError` from `@/lib/signing/errors` is the typed error. Redirects to `/kyc` (not_started/in_progress/rejected/expired) or `/kyc/status` (submitted/under_review).
