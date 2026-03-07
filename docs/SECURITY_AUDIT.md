# Security Audit Report — Accountabul / property-web3-portal
**Date:** 2026-03-06
**Scope:** Full stack — React frontend, Supabase edge functions, DB migrations, RLS policies
**Classification:** Financial application — XRPL tokenization, KYC/PII, wallet operations

---

## Executive Summary

**22 findings** across the full stack. **7 Critical, 7 High, 6 Medium, 2 Low.**
The most exploitable chains right now:
- Wallet takeover via xaman payload hijack (SEC-004) + plaintext DB secrets (SEC-001)
- Portfolio IDOR — any user can read/write any other user's portfolio (SEC-003)
- KYC enforcement is client-side only — anyone can call `xrpl-build-mint` directly (SEC-014)
- Wildcard CORS allows any site to trigger minting/KYC on behalf of logged-in users (SEC-002)

---

## Findings

### CRITICAL

#### SEC-001 — Plaintext Wallet Secrets in Database
**File:** `supabase/migrations/20260305164714_bf03adc9.sql`, `supabase/functions/xrpl-submit-signed/index.ts`
**Category:** Secrets / Credential Exposure

`wallet_secret` column stores XRPL seed phrases in plaintext. Used directly for auto-signing:
```typescript
const secret = walletRow.wallet_secret;
const wallet = Wallet.fromSeed(secret);
```
**Impact:** DB breach = complete compromise of every testnet wallet. Same pattern would apply to mainnet.
**Fix:** Encrypt secrets with envelope encryption (KMS or per-user KDF). Never store plaintext seeds.

---

#### SEC-002 — Wildcard CORS on All 19 Edge Functions
**File:** All `supabase/functions/*/index.ts`
**Category:** CORS / CSRF

Every function has:
```typescript
'Access-Control-Allow-Origin': '*'
```
**Impact:** Any website can call these functions on behalf of authenticated users — triggering minting, KYC submissions, wallet ops.
**Fix:** Set allowed origins from env var. Validate `Origin` header before responding.

---

#### SEC-003 — Portfolio/Order Tables Allow Cross-User Read & Write (IDOR)
**File:** `supabase/migrations/20260303100822_c8504098.sql`
**Category:** RLS / IDOR

```sql
CREATE POLICY "Anyone can read portfolio holdings" ON public.portfolio_holdings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert portfolio holdings" ON public.portfolio_holdings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert token orders" ON public.token_orders FOR INSERT WITH CHECK (true);
```
**Impact:** User A can read User B's full portfolio and inject fake holdings or orders.
**Fix:** Scope all policies to `auth.uid()` ownership. Verify the later DROP migrations actually removed these.

---

#### SEC-004 — Wallet Hijacking / Account Takeover via Xaman Payload
**File:** `supabase/functions/xaman-check-payload/index.ts`
**Category:** Authorization / Account Takeover

When a payload is signed, the returned wallet address is linked to **whoever called the endpoint**, without verifying the signer intended to link to that account:
```typescript
await supabase.from('user_wallets').upsert({
  user_id: userId,       // ← caller's user ID
  wallet_address,        // ← wallet that signed (could be anyone's)
  ...
}, { onConflict: 'wallet_address' });
```
**Attack:** Attacker tricks User A into scanning a QR. Attacker submits the signed payload as themselves → User A's wallet is now linked to Attacker's account.
**Impact:** Complete takeover — attacker can mint, send, and sign on-ledger from victim's wallet.
**Fix:** Store the intended `user_id` binding in the payload *at creation time* in `kyc-create-payload`. On check, verify the wallet matches the bound user.

---

#### SEC-005 — No Input Length Limits on Mint Metadata
**File:** `supabase/functions/xrpl-build-mint/index.ts`
**Category:** Input Validation

All user-supplied fields (name, description, owner_email, image_url) fed directly into the 1024-byte XLS-89 metadata builder with no pre-validation. Trimming logic is lossy and can silently corrupt data.
**Impact:** Malformed/truncated metadata on-chain; potential DOS via oversized inputs.
**Fix:** Enforce per-field max lengths before building metadata object. Return 400 instead of silently truncating.

---

#### SEC-006 — Mint Page Has No Auth Guard
**File:** `src/pages/Mint.tsx`
**Category:** Authentication

```typescript
const Mint = () => (
  <div className="min-h-screen bg-background">
    <Navigation />
    <MintWizard />   {/* No useAuth() check */}
  </div>
);
```
**Impact:** Unauthenticated users load the full minting UI. Edge function likely enforces auth, but this violates defence-in-depth.
**Fix:** Add `useAuth()` + redirect to `/auth` if no session.

---

#### SEC-007 — No Rate Limiting on Any Endpoint
**File:** All edge functions
**Category:** DOS / Abuse

No rate limiting on: `kyc-start/save/submit`, `xaman-create-payload`, `xrpl-build-mint`, `xrpl-submit-signed`.
**Impact:** Spam KYC submissions; exhaust Xaman API quota; flood XRPL transactions; log flooding.
**Fix:** Implement per-user rate limiting (Supabase KV or Upstash Redis) on all sensitive functions.

---

### HIGH

#### SEC-008 — No Request Body Schema Validation
**File:** `kyc-save/index.ts`, `kyc-submit/index.ts`, `xaman-check-payload/index.ts`, `xrpl-build-mint/index.ts`
**Category:** Input Validation

`await req.json()` used without type-checking or schema validation. Wrong types or unexpected fields accepted silently.
**Fix:** Use Zod schemas to validate and strip all incoming request bodies.

---

#### SEC-009 — Service Role Client Used for User-Scoped Data
**File:** `kyc-start/index.ts`, `kyc-save/index.ts`, `kyc-submit/index.ts`, `xaman-check-payload/index.ts`
**Category:** Privilege Escalation / Audit

Service role bypasses RLS. Using it for user data operations makes RLS policies irrelevant and increases blast radius of any auth bypass.
**Fix:** Use `createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })` for user-scoped reads/writes. Reserve service role for system-only operations (audit logs, cross-user admin).

---

#### SEC-010 — Network Field Defaults to `mainnet` Without Validation
**File:** `src/contexts/ActiveWalletContext.tsx`
**Category:** Input Validation / Fund Safety

```typescript
network: (w.network === 'testnet' ? 'testnet' : 'mainnet')
```
Any non-`testnet` value silently becomes mainnet, including `null`, `undefined`, misspellings.
**Impact:** Testnet wallet treated as mainnet → user sends real XRP to testnet address.
**Fix:** Strict check — throw if value is not exactly `'testnet'` or `'mainnet'`.

---

#### SEC-011 — KYC Submit Accepts Empty Strings as Valid Fields
**File:** `supabase/functions/kyc-submit/index.ts`
**Category:** Input Validation

Required field check is `!formData[field]` — falsy. Empty string `""` passes.
**Impact:** KYC cases can be submitted and approved with completely blank fields.
**Fix:** `value.trim().length >= 1` minimum; add per-field type/format validators (date format, postal code regex, etc.).

---

#### SEC-012 — Xaman Payload UUID Not Format-Validated
**File:** `supabase/functions/xaman-check-payload/index.ts`
**Category:** Input Validation

UUID is passed directly to the Xaman API URL without format checking.
**Impact:** Malformed UUID causes unhandled API errors; attacker can probe arbitrary UUIDs.
**Fix:** Validate against `/^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$/i` before use.

---

#### SEC-013 — No Idempotency on State-Changing Operations
**File:** `kyc-submit/index.ts`, `kyc-admin-review/index.ts`, `xrpl-submit-signed/index.ts`
**Category:** Race Condition / TOCTOU

Network timeouts cause clients to retry. Without idempotency keys, retries can: submit KYC twice, apply admin review twice, or double-submit XRPL transactions.
**Fix:** Accept `Idempotency-Key` header; store request fingerprint + response in a `request_log` table; return cached response on duplicate.

---

#### SEC-014 — KYC Approval Enforced Client-Side Only
**File:** `supabase/functions/xrpl-build-mint/index.ts`, `xrpl-submit-signed/index.ts`
**Category:** Authorization Bypass

`KycGate` component in React redirects unapproved users away from `/mint`. But edge functions don't call `get_kyc_status()` — any user with a JWT can call them directly with `curl`.
**Impact:** Regulatory bypass — non-KYC'd users can mint RWA tokens.
**Fix:** Add `get_kyc_status(user.id)` check at the top of `xrpl-build-mint` and `xrpl-submit-signed`. Return 403 if not `'approved'`.

---

### MEDIUM

#### SEC-015 — Testnet Faucet Returns Seed Phrase to Browser
**File:** `supabase/functions/xrpl-testnet-faucet/index.ts`
**Category:** Secrets Exposure

```typescript
return new Response(JSON.stringify({ success: true, address, balance, secret }));
```
Seed phrase returned in HTTP response → browser memory, DevTools network tab, logs.
**Fix:** Store secret server-side only (encrypted). Never return seed to client.

---

#### SEC-016 — Xaman Return URL Built from Unvalidated Origin Header
**File:** `supabase/functions/xaman-create-payload/index.ts`
**Category:** Open Redirect / Host Header Injection

```typescript
web: `${req.headers.get('origin') || req.url.split('/functions/')[0]}`
```
Attacker sets `Origin: https://phishing.com` → Xaman redirects user there after signing.
**Fix:** Validate origin against allowlist from env var before using it as return URL.

---

#### SEC-017 — External XRPScan API Response Not Validated
**File:** `supabase/functions/xaman-check-payload/index.ts`
**Category:** External Data / Injection

XRPScan name/username response stored directly in DB with no format validation.
**Fix:** Validate response against safe character set regex before storing.

---

#### SEC-018 — Plaintext IPs in Wallet Audit Log
**File:** `supabase/functions/wallet-audit-log/index.ts`
**Category:** Privacy / PII

`x-forwarded-for` stored as-is. Can also be spoofed (no validation).
**Fix:** Hash with a per-install salt. Discard raw IP.

---

#### SEC-019 — `wallet_secret` Column Has No Column-Level Encryption
**File:** DB schema
**Category:** Data at Rest

Even if application-level encryption is added, the column itself has no Postgres-level encryption or access controls beyond row-level.
**Fix:** Consider `pgcrypto` column encryption as defence-in-depth even after app-level encryption is added.

---

#### SEC-020 — `ai-debate` Edge Function Has Open CORS and No Auth
**File:** `supabase/functions/ai-debate/index.ts`
**Category:** Authentication / Cost Abuse

AI debate function may call Claude/GPT APIs without auth enforcement — could be exploited to rack up API costs.
**Fix:** Verify auth header and team membership check before forwarding to AI APIs.

---

## Summary Table

| ID | Severity | Category | Issue |
|---|---|---|---|
| SEC-001 | **Critical** | Secrets | Plaintext wallet secrets in DB |
| SEC-002 | **Critical** | CORS | Wildcard origin on all edge functions |
| SEC-003 | **Critical** | RLS/IDOR | Portfolio/order tables world-readable/writable |
| SEC-004 | **Critical** | AuthZ/ATO | Wallet hijacking via xaman payload |
| SEC-005 | **Critical** | Validation | No field length limits in mint metadata |
| SEC-006 | **Critical** | AuthN | No auth guard on Mint page |
| SEC-007 | **Critical** | DOS | No rate limiting anywhere |
| SEC-008 | High | Validation | No request body schema validation |
| SEC-009 | High | AuthZ | Service role used for user data |
| SEC-010 | High | Validation | Network field defaults to mainnet unsafely |
| SEC-011 | High | Validation | Empty strings pass KYC field validation |
| SEC-012 | High | Validation | Xaman UUID not format-validated |
| SEC-013 | High | Race Condition | No idempotency on state-changing ops |
| SEC-014 | High | AuthZ | KYC approval not enforced server-side |
| SEC-015 | Medium | Secrets | Faucet returns seed phrase to browser |
| SEC-016 | Medium | Redirect | Xaman return URL from unvalidated Origin |
| SEC-017 | Medium | Ext. Data | XRPScan response not validated |
| SEC-018 | Medium | Privacy | Plaintext IPs in audit log |
| SEC-019 | Medium | Encryption | No column-level encryption on wallet_secret |
| SEC-020 | Medium | AuthN | ai-debate function may have no auth |

---

## Remediation Batches

### Batch 1 — Exploit-Ready Criticals (do first)
SEC-004 (wallet hijack), SEC-003 (portfolio IDOR), SEC-014 (KYC server enforcement), SEC-006 (Mint auth guard)

### Batch 2 — Hardening Criticals
SEC-001 (encrypt wallet secrets), SEC-002 (CORS lockdown), SEC-007 (rate limiting)

### Batch 3 — Input Validation
SEC-005, SEC-008, SEC-011, SEC-012 (all validation gaps)

### Batch 4 — Architecture Improvements
SEC-009 (service role scope), SEC-013 (idempotency), SEC-010 (network validation)

### Batch 5 — Medium / Cleanup
SEC-015, SEC-016, SEC-017, SEC-018, SEC-019, SEC-020
