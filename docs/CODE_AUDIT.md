# Code Audit — Property Web3 Portal (RWA)

> **Purpose**: Identify bad practices, bugs, and technical debt in the V1 prototype before the spec-driven V2 rebuild.
> **Severity**: 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low
> **Last Updated**: 2026-03-06

---

## Summary

This codebase was built iteratively with an AI-assisted tool (Lovable) and has accumulated significant technical debt through rapid iteration. The commit history shows 250+ commits with many "Changes", "Fix X", and repeated approaches to the same features. The code works but is not suitable for production as-is. The issues below should drive the V2 spec.

---

## 🔴 Critical Issues

### C1. `wallet_secret` Stored Unencrypted in Database

**Location**: `contexts/ActiveWalletContext.tsx:162`, `supabase/functions/xrpl-submit-signed/index.ts`

**Problem**: The testnet faucet flow stores the wallet's raw private key (`wallet_secret`) directly in the `user_wallets` table. The edge function `xrpl-submit-signed` reads this secret from the DB to sign transactions server-side.

```typescript
// ActiveWalletContext.tsx — this goes to the DB
const upsertData: Record<string, unknown> = {
  ...(walletSecret ? { wallet_secret: walletSecret } : {}),
};
```

**Risks**:
- If the DB is ever breached, all testnet wallet secrets are exposed
- There is no runtime guard preventing a mainnet wallet from being stored this way
- The `user_wallets_safe` view hides the column, but the underlying table is fully accessible to service role

**V2 Fix**: Use a proper secrets vault (e.g., Supabase Vault / encrypted columns) for any stored key material. Better: eliminate server-side key storage entirely — use hardware wallets or a proper HSM for mainnet. Testnet auto-sign can use a single platform-owned funded wallet instead of user-specific secrets.

---

### C2. Stale Closure Bug in `MintWizard` Timeout

**Location**: `components/mint/MintWizard.tsx:194-200`

**Problem**: The 5-minute timeout checks `mintStatus === 'pending'` but `mintStatus` is captured at the time the arrow function was created. React state updates do not update closures — this check will always read the initial value of `mintStatus` (`'draft'` or `'pending'` at the time of the `handleSubmit` call), not the current state.

```typescript
// BUG: mintStatus is stale in this closure
setTimeout(() => {
  clearInterval(poll);
  if (mintStatus === 'pending') {  // ← always reads stale value
    setMintStatus('failed');
    setMintError('Signing timed out.');
  }
}, 300_000);
```

**Impact**: The timeout may incorrectly set a completed mint to 'failed', or fail to fire if the user already cancelled.

**V2 Fix**: Use a `useRef` to track current status, or manage polling/timeout lifecycle with `useReducer`.

---

### C3. `setInterval` Leaks on Component Unmount

**Location**: `components/SendModal.tsx:172-193`, `components/mint/MintWizard.tsx:163-191`

**Problem**: In `handleSign` (SendModal), a `setInterval` is created inside an async function. If the user closes the modal or navigates away while the interval is running, the interval continues running and attempting state updates on an unmounted component. The only cleanup is a 5-minute `setTimeout` that calls `clearInterval` — this is unreliable.

```typescript
// No cleanup reference stored for unmount
const pollInterval = setInterval(async () => { ... }, 2000);
// Only cleanup is after 5 minutes
setTimeout(() => clearInterval(pollInterval), 300000);
```

**V2 Fix**: Store interval refs in `useRef` and clear them in `useEffect` cleanup functions. Use `AbortController` for cancellable polling.

---

## 🟠 High Priority Issues

### H1. `type: any` Used Throughout — No XRPL Type Safety

**Location**: `xrpl-account-data/index.ts` (entire file), `ActiveWalletContext.tsx:87`, `MintWizard.tsx:113`

**Problem**: XRPL API responses are typed as `any` everywhere. This means:
- No compile-time safety when XRPL response shapes change
- IDE autocomplete doesn't work
- Bugs from field name typos (e.g., `tx.Amount` vs `tx.amount`) are not caught

**V2 Fix**: Define TypeScript interfaces for all XRPL JSON-RPC response shapes. Consider using the `xrpl.js` library which provides these types.

---

### H2. Duplicated Wallet Mapping Logic

**Location**: `contexts/ActiveWalletContext.tsx:87-97` and `180-193`

**Problem**: The DB row → `ConnectedWallet` mapping is copy-pasted identically in two places: the `fetchWallets` effect and the `addWallet` callback. Any schema change must be updated in both places.

```typescript
// Duplicated exactly in two places — FRAGILE
const mapped: ConnectedWallet[] = (data || []).map((w: any) => ({
  id: w.id,
  address: w.wallet_address,
  label: w.label || w.xaman_account_name || `Wallet`,
  ...
}));
```

**V2 Fix**: Extract a `mapDbWalletToConnectedWallet(row: DbWallet): ConnectedWallet` pure function.

---

### H3. `ActiveWalletContext` Has Too Many Responsibilities

**Location**: `contexts/ActiveWalletContext.tsx` (300 lines)

**Problem**: This single context handles:
1. DB wallet loading + sync
2. Active wallet selection + localStorage persistence
3. Wallet CRUD (add, remove, rename, disconnect)
4. Audit logging (fire-and-forget)
5. Connect modal visibility state
6. Inactivity timeout orchestration
7. Toast notifications

This violates the Single Responsibility Principle. Any change to one area risks breaking others.

**V2 Fix**: Split into:
- `WalletRepository` — DB operations only
- `ActiveWalletContext` — selection state + localStorage
- `WalletConnectContext` — modal state
- Move inactivity timeout to a standalone hook, not embedded in context

---

### H4. Explorer URL Hardcoded to Livenet

**Location**: `components/SendModal.tsx:577`

**Problem**: The success receipt always links to `livenet.xrpl.org` regardless of the `network` prop passed to `SendModal`. If a testnet transaction completes, the explorer link will show "not found."

```typescript
href={`https://livenet.xrpl.org/transactions/${txHash}`}  // ← ignores network prop
```

**V2 Fix**:
```typescript
const explorerBase = network === 'testnet'
  ? 'https://testnet.xrpl.org/transactions'
  : 'https://livenet.xrpl.org/transactions';
```

---

### H5. `decodeCurrency` Defined Inline — Not Shared

**Location**: `components/SendModal.tsx:70-75`

**Problem**: The hex → ASCII currency decoder is defined as a local function inside `SendModal`. The same logic appears (or is needed) in `PortfolioSection`, `xrpl-account-data`, and anywhere XRPL currency codes are displayed. This causes drift — one component might decode correctly while another displays raw hex.

**V2 Fix**: Extract to `src/lib/xrpl-utils.ts` as an exported utility.

---

### H6. `token_mints` Table Not in Supabase Types

**Location**: `components/mint/MintWizard.tsx:121`, line 184

**Problem**: `supabase.from('token_mints' as any)` — the `as any` cast bypasses TypeScript's type checking entirely, meaning there's no compile-time safety for table queries, inserts, or updates.

**Root Cause**: The Supabase types file (`integrations/supabase/types.ts`) hasn't been regenerated after the `token_mints` table was added.

**V2 Fix**: Run `supabase gen types typescript` after every migration to keep types in sync. Make this part of the build process.

---

### H7. Hardcoded XRPL Reserves

**Location**: `xrpl-account-data/index.ts:378-381`

**Problem**: The base reserve (1 XRP) and owner reserve (0.2 XRP per object) are hardcoded. While these happen to be correct as of 2024, XRPL reserve amounts are governance-adjustable by validator vote and can change.

```typescript
const baseReserve = 1;      // hardcoded
const ownerReserve = 0.2;   // hardcoded
```

**V2 Fix**: Fetch reserves dynamically from `server_info.validated_ledger.reserve_base` and `reserve_inc` on each call (or cache with short TTL).

---

### H8. Test Data Hardcoded in Production Form Component

**Location**: `components/mint/MPTForm.tsx:174-252`

**Problem**: `RANDOM_PROPERTIES`, `RANDOM_OWNERS`, `RANDOM_IMAGES`, and `RANDOM_DESCRIPTIONS` arrays with fake data are defined directly in the `MPTForm` production component. The "Generate Test Data" button uses `Math.random()`. This:
- Adds ~2KB of dead weight to the production bundle
- Introduces non-determinism (different output on every click)
- Ships real-looking fake data (emails, addresses) to production

**V2 Fix**: Move test data generation to a separate development-only module. Gate behind `import.meta.env.DEV` or a feature flag. Remove from production build entirely.

---

## 🟡 Medium Priority Issues

### M1. `useAuth` Double State Set on Mount

**Location**: `hooks/useAuth.ts:10-20`

**Problem**: `useAuth` subscribes to `onAuthStateChange` AND calls `getSession()`. On initial page load, both may fire and set `user` state twice synchronously, causing two renders.

**V2 Fix**: Use only `onAuthStateChange` — it fires immediately with the current session on subscribe (Supabase v2 behavior). Remove the `getSession()` call.

---

### M2. No React Error Boundaries

**Location**: Everywhere — no Error Boundaries exist in the app

**Problem**: If any component throws a runtime error (e.g., a malformed XRPL response causes a `.map()` crash), the entire application unmounts and shows a blank screen. This is especially risky for the `PortfolioSection` which processes live blockchain data.

**V2 Fix**: Wrap major sections (Portfolio, Mint, Marketplace) in Error Boundaries that show a graceful fallback UI.

---

### M3. No Rate Limiting on Edge Functions

**Location**: All edge functions

**Problem**: Any authenticated (or even unauthenticated) caller can invoke edge functions as many times as they want. The `xrpl-account-data` function has an in-memory cache as a partial mitigation, but there's no per-user rate limiting anywhere.

**V2 Fix**: Implement rate limiting in edge functions using a token bucket pattern with Supabase KV or Redis. At minimum, limit by IP address.

---

### M4. Polling Interval Not Centralized

**Location**: `SendModal.tsx:191` (2000ms), `MintWizard.tsx:192` (3000ms), `WalletConnectModal.tsx` (unknown)

**Problem**: Xaman payload polling intervals are hardcoded at different values across components. Inconsistency means a payment poll might time out faster than a mint poll.

**V2 Fix**: Define a single `XAMAN_POLL_INTERVAL_MS = 2000` constant in a shared config file. All Xaman polling should use the same interval.

---

### M5. `wallet_profiles` Table Is Now Redundant

**Location**: DB schema, `xaman-check-payload/index.ts`

**Problem**: The original design used `wallet_profiles` for wallet-first auth (no Supabase Auth). After adding Supabase Auth + `user_wallets`, there are now two tables tracking wallet identity. The `xaman-check-payload` function still upserts into `wallet_profiles` even though `user_wallets` is the authoritative source.

**V2 Fix**: In V2, remove `wallet_profiles` and consolidate all wallet identity into `user_wallets`. Update `xaman-check-payload` accordingly.

---

### M6. `useXRPLSubscription` Hook — Purpose Unclear

**Location**: `hooks/useXRPLSubscription.ts`

**Problem**: This hook exists but its usage is unclear from the file inventory. If it opens a WebSocket to an XRPL node for real-time updates, it conflicts with the React Query polling approach in `useXRPLPortfolio`. Two sources of truth for live data can cause race conditions and UI flicker.

**V2 Fix**: Choose one approach: WebSocket subscription (lower latency, more complex) or React Query polling (simpler, works fine for 30-90s refresh cycles). Remove the other.

---

### M7. No Loading State on Destructive Wallet Operations

**Location**: `contexts/ActiveWalletContext.tsx:202-223` (`removeWallet`), `239-253` (`disconnectAll`)

**Problem**: `removeWallet` and `disconnectAll` are async DB operations but provide no loading feedback. A user who double-clicks "Remove Wallet" can trigger two concurrent DB updates.

**V2 Fix**: Add optimistic updates with rollback, or add a loading state that disables the action button.

---

### M8. `MPTForm` Uses `key={idx}` for List Items

**Location**: `components/mint/MPTForm.tsx:447`

**Problem**: URI list items use `key={idx}` (array index). When items are reordered or deleted, React's reconciliation can incorrectly reuse DOM nodes, causing input values to appear in the wrong fields.

**V2 Fix**: Use a stable unique ID for each URI item (e.g., `crypto.randomUUID()` assigned at creation time).

---

### M9. Sequential XRPL Requests with Fixed Delays

**Location**: `xrpl-account-data/index.ts:358-366`

**Problem**: The five XRPL calls (account_info, account_lines, account_tx, mpt_issuances, mpt_holdings) are made sequentially with 100ms sleep delays between them. This means portfolio load takes at minimum `4 × (100ms + round-trip time)`. On a slow connection this could be 1-2 seconds just in delay.

The delays were added to avoid rate limiting, but there's no evidence the XRPL nodes actually rate-limit on sequential requests from the same IP.

**V2 Fix**: Try `Promise.all()` first. If rate limiting is observed, use a proper exponential backoff, not a fixed sleep.

---

## 🔵 Low Priority / Cleanup

### L1. Dead Code — Legacy localStorage Keys Cleaned Up On Every Mount

**Location**: `contexts/ActiveWalletContext.tsx:119-123`

Removes `accountabul_wallets` and `wallet_address` keys on every mount. This was a migration shim for moving from localStorage to DB storage. Can be removed after sufficient time has passed.

---

### L2. `any` Cast for `getParams()` in `MintWizard`

**Location**: `components/mint/MintWizard.tsx:55-59`

`getParams()` returns `NFTParams | MPTParams | IOUParams` but isn't typed as such. The return type should be explicit.

---

### L3. Inconsistent Error Handling in `handleContinue`

**Location**: `components/SendModal.tsx:148-153`

The error toast message hardcodes "Insufficient Balance:" as a prefix regardless of the actual error. Build failures can fail for other reasons (invalid address, network error, etc.).

---

### L4. No Pagination for Transaction History

The app fetches only the last 20 transactions. For active wallets, this is a poor experience. There's no "load more" or pagination support in `xrpl-account-data` or `useXRPLPortfolio`.

---

### L5. No Audit Log Retention Policy

`wallet_audit_log` grows indefinitely. On a production system with many users this table will become very large. No archiving or retention policy exists.

---

### L6. `schema` Field in MPT Metadata Always `null`

**Location**: `xrpl-account-data/index.ts:188`

`schema: metadata.schema || null` — the `schema` field from XLS-89 is returned but never populated by the mint flow. Dead field in the response.

---

## What V2 Must Fix

The following issues are **must-fix** before V2 launches:

1. **C1** — Never store raw private keys in a relational database
2. **C2** — Fix stale closure in timeout logic
3. **C3** — Fix interval leaks on unmount
4. **H4** — Fix explorer URL for testnet
5. **H5** — Centralize XRPL utility functions
6. **H6** — Keep Supabase types in sync with migrations (automate)
7. **M2** — Add Error Boundaries to all major sections
8. **M3** — Add rate limiting to edge functions

The following are **nice-to-have** for V2:

- H3: Split `ActiveWalletContext`
- M1: Clean up `useAuth`
- M5: Remove `wallet_profiles` table
- M6: Consolidate real-time approach (WebSocket vs polling)
- M9: Parallelize XRPL requests
