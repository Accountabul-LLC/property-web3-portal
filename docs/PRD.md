# Product Requirements Document: Xaman Wallet Integration & Crypto-Native Features

> **Version**: 1.0  
> **Date**: 2026-03-05  
> **Status**: Reference document for V2 rebuild  
> **Platform**: XRPL Mainnet

---

## 1. Product Overview

An XRPL-native real estate tokenization platform using **wallet-first authentication** (no email/password). Users connect via the **Xaman (formerly XUMM) wallet app** by scanning a QR code and cryptographically signing a request. The wallet address (`r...`) serves as the user's identity throughout the application.

**Key Principle**: No private keys ever touch the application. All transaction signing happens inside the Xaman mobile app.

---

## 2. User Stories & Flows

### 2.1 Wallet Connection (Authentication)

**As a user, I want to connect my XRPL wallet so I can access my portfolio and transact.**

**Flow**:
1. User clicks "Connect Wallet" → modal opens with wallet provider options
2. User selects "Connect with Xaman" → edge function creates a `SignIn` payload via Xaman API
3. QR code is displayed → user scans with Xaman mobile app
4. User signs the request in Xaman → app polls for signature status every 2 seconds
5. On success: wallet address extracted from signed payload, `wallet_profiles` record upserted, wallet added to local state
6. Timeout: 5 minutes (300 seconds)

**Acceptance Criteria**:
- QR code renders immediately after clicking "Connect with Xaman"
- "Waiting for signature..." spinner shown during polling
- Signed wallet address is persisted in `wallet_profiles` table with `last_login` timestamp
- `xaman_payloads` table tracks payload lifecycle (pending → signed/cancelled/expired)
- User sees success confirmation with wallet address before modal closes

### 2.2 Multi-Wallet Management

**As a user, I want to connect multiple wallets and switch between them.**

**Capabilities**:
- **Add wallet**: Connect additional wallets via the same Xaman QR flow
- **Switch active wallet**: Click any wallet in the selector dropdown to make it active; updates `lastUsedAt`
- **Rename wallet**: Inline edit labels (e.g., "Primary", "Trading", "Cold Storage")
- **Remove wallet**: Remove individual wallets with fallback to next available
- **Disconnect all**: Remove all wallets and clear local state

**State Management**:
- Wallet list stored in `localStorage` under key `accountabul_wallets` (array of `ConnectedWallet` objects)
- Active wallet address stored under key `accountabul_active_wallet`
- Legacy migration: if old single-wallet key `wallet_address` exists, auto-migrate to new format

**ConnectedWallet Object**:
```typescript
interface ConnectedWallet {
  address: string;      // XRPL r-address
  label: string;        // User-defined label
  connectedAt: string;  // ISO 8601 timestamp
  lastUsedAt: string;   // ISO 8601 timestamp
}
```

### 2.3 Portfolio View

**As a user, I want to see my real-time XRPL portfolio with balances, tokens, and transaction history.**

**Data Sources**: Live XRPL ledger queries (no database persistence for on-chain data)

**Display Elements**:
- **XRP Balance**: Native currency balance converted from drops (÷ 1,000,000)
- **Token Holdings**: All trustlines with non-zero balances, showing currency name, issuer (shortened), balance, and limit
- **Recent Transactions**: Last 20 on-chain transactions with type, direction (sent/received), amount, currency, date, status badge (✓/✗), and link to XRPL Explorer

**Hex Currency Decoding**: Token currencies stored as 40-char hex on XRPL are decoded to ASCII for display (e.g., `4C50000...` → `LP`).

### 2.4 Shareable Portfolio URLs

**As a user, I want to share a read-only view of any wallet's portfolio.**

- URL format: `/portfolio?account=rXXXXXXXXXX`
- When `?account=` differs from connected wallet → read-only mode (no Send/Receive buttons)
- No authentication required to view

### 2.5 Send XRP

**As a user, I want to send XRP to another XRPL address.**

**5-Step Flow**:
1. **Asset Selection**: Choose XRP from list of holdings (XRP + all IOU tokens with balance)
2. **Form**: Enter destination address, amount, optional destination tag (toggle), optional memo (max 300 chars)
3. **Review**: Confirm all details including network fee (12 drops = 0.000012 XRP), warnings (low balance, etc.)
4. **Signing**: QR code displayed → user scans and signs in Xaman app (2s polling)
5. **Receipt**: Success with tx hash link to XRPL Explorer, or error with retry option

**Validation Rules**:
- Destination address: regex `/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/`
- Cannot send to self
- Amount must be positive, ≤ spendable balance
- Spendable = balance − reserve (10 XRP base + 2 XRP × owner_count)
- Destination tag: integer 0–4,294,967,295
- Memo: max 300 characters, hex-encoded as `MemoType` (text/plain) + `MemoData`

**Server-side Verification**: The `xrpl-build-payment` edge function verifies the sender wallet exists in `wallet_profiles` before building the transaction (403 if unverified).

### 2.6 Send IOU Tokens

**Same 5-step flow as XRP with additional validations:**

- Sender must have an active trustline for the currency+issuer pair
- Amount checked via decimal-safe string comparison (no floating point)
- Maximum precision: 15 significant digits (XRPL limit)
- Issuer freeze detection: if `freeze_peer` is set, transaction is blocked
- Issuer authorization warning: if `authorized === false`, warning displayed
- Destination trustline warning: "Ensure the recipient has a trustline for this token"

### 2.7 Receive

**As a user, I want to display my address for receiving funds.**

**Display**:
- QR code of wallet address (via `qrcode.react`, SVG format, error correction level "H")
- Full address displayed with copy-to-clipboard button
- Network badge: "XRPL Mainnet"
- Warning: "Only send XRP or XRPL-based tokens to this address. Sending assets from other networks will result in permanent loss."

### 2.8 Audit Logging

**As a platform operator, I want an immutable trail of all wallet lifecycle events.**

**Events Logged**:
| Event | Trigger | Metadata |
|---|---|---|
| `connect` | Wallet connected via Xaman | `{ is_new: boolean, label: string }` |
| `disconnect` | Single wallet removed | — |
| `disconnect_all` | All wallets removed | — |
| `switch_to` | Wallet activated | `{ switched_from: string }` |
| `switch_from` | Wallet deactivated | `{ switched_to: string }` |

**Captured Context**: IP hint (from `x-forwarded-for`), user agent string, timestamp.

**Implementation**: Fire-and-forget pattern — audit failures never block UI operations.

---

## 3. Security Requirements

| Requirement | Implementation |
|---|---|
| No custodial keys | All signing in Xaman app; platform never sees private keys |
| Wallet ownership verification | `xrpl-build-payment` and `xrpl-build-token-payment` check `wallet_profiles` table before building transactions (403 if not verified via Xaman) |
| No direct XRPL access from browser | All XRPL RPC calls proxied through edge functions to prevent CORS and direct node access |
| Audit trail | All wallet lifecycle events logged to `wallet_audit_log` table with IP and user agent |
| Input validation | Server-side validation of addresses, amounts, destination tags, and memo length |
| Reserve protection | Payment build checks spendable balance (balance − reserve) to prevent account deletion |

---

## 4. Non-Functional Requirements

| Requirement | Value | Rationale |
|---|---|---|
| React Query `staleTime` | 15 seconds | Instant wallet toggling without refetch |
| React Query `gcTime` | 5 minutes | Keep inactive wallet data cached for quick switch-back |
| React Query `refetchInterval` | 30 seconds | Background auto-refresh for active wallet |
| Edge function cache TTL | 10 seconds | In-memory cache on `xrpl-account-data` to protect XRPL nodes |
| Cache eviction | 100 entries max | Prevent memory leaks on edge function |
| Xaman payload expiry | 5 minutes (300s) | Both sign-in and payment payloads |
| Polling interval | 2 seconds | Payload status check frequency |
| Network fee | 12 drops (0.000012 XRP) | Standard XRPL base fee |
| `LastLedgerSequence` | validated_ledger + 30 | Transaction expiry window (~2 minutes) |

---

## 5. Data Model (Crypto-Specific Tables)

### 5.1 `wallet_profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `wallet_address` | text (unique) | XRPL r-address |
| `display_name` | text (nullable) | User-set display name |
| `avatar_url` | text (nullable) | Profile image URL |
| `created_at` | timestamptz | First connection time |
| `last_login` | timestamptz | Updated on each Xaman sign-in |

### 5.2 `xaman_payloads`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `uuid` | text | Xaman payload UUID |
| `status` | text | `pending` / `signed` / `cancelled` / `expired` |
| `wallet_address` | text (nullable) | Set on successful sign |
| `signed_at` | timestamptz (nullable) | Signature timestamp |
| `created_at` | timestamptz | Payload creation time |

### 5.3 `wallet_audit_log`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `wallet_address` | text | Subject wallet |
| `event_type` | text | One of: connect, disconnect, switch_to, switch_from, disconnect_all |
| `metadata` | jsonb | Event-specific data |
| `ip_hint` | text (nullable) | From x-forwarded-for header |
| `user_agent` | text (nullable) | Browser user agent |
| `created_at` | timestamptz | Event timestamp |

---

## 6. Known Limitations / V2 Gaps

1. **No WebSocket payload status** — Uses 2s HTTP polling instead of Xaman WebSocket for real-time status
2. **No destination trustline pre-check** — IOU sends warn but don't verify recipient has a trustline
3. **No MPT support** — Multi-Purpose Tokens (XLS-33) not displayed in portfolio
4. **Limited transaction history** — Reads only 20 most recent transactions from ledger; no database persistence
5. **Single-tenant architecture** — No user isolation beyond wallet address; no multi-tenant support
6. **No rate limiting** — Edge functions have no request throttling
7. **No audit log retention policy** — Logs grow indefinitely
8. **No offline/error recovery** — If Xaman signing is interrupted, no way to resume
9. **Hardcoded reserves** — 10 XRP base + 2 XRP/object; should query `server_info` dynamically
10. **No token metadata** — No lookup for token names, icons, or issuer verification status

---

## 11. Tokenization Intake (Simplified V1)

### Overview

`/tokenize` saves directly into the `properties` table. `properties.status` drives the entire workflow — no separate `tokenization_requests` table needed.

### Flow

1. **Save Draft** — User fills out `/tokenize` form → upserts into `properties` with `status = 'draft'`
2. **Submit** — User clicks submit → updates the same row to `status = 'submitted'` and sets `submitted_at = now()`
3. **Admin Review** — Admin changes status through the pipeline: `under_review` → `needs_info` → `approved` → `rejected`

### Status Enum (V1)

`draft` | `submitted` | `under_review` | `needs_info` | `approved` | `rejected`

### Database

Uses the existing `properties` table with these additional columns:

| Column | Type | Notes |
|---|---|---|
| `owner_user_id` | uuid (FK → auth.users) | Supabase Auth user who submitted |
| `address_display` | text | Human-readable address string |
| `address_json` | jsonb | Structured address (optional) |
| `submitted_at` | timestamptz | Set when status changes to submitted |
| `review_notes` | text | Admin feedback / notes |

### API (Edge Function: `tokenization-pipeline`)

| Method | Path Hint | Auth | Description |
|---|---|---|---|
| GET | `/mine` | Authenticated user | Returns `properties` where `owner_user_id = auth.uid()` |
| GET | `/` | Admin only | Returns properties with `status IN (submitted, under_review, needs_info, approved, rejected)` |
| PATCH | `/` | Admin only | Updates `status` and `review_notes` for a given `property_id` |

### Security (RLS)

- Users can only read/write their own properties (`owner_user_id = auth.uid()`)
- Admins (via `user_roles` table + `has_role()` security definer function) can read/write all properties
- Anonymous users can read `approved` properties only (public marketplace, V2)

### Authentication

Supabase Auth (email/password) at `/auth`. The `owner_user_id` column links properties to authenticated users.

### Acceptance Criteria

- [ ] Submitting creates/updates a `properties` row with correct status
- [ ] Admin pipeline API returns all `submitted+` properties
- [ ] Users only see their own records
- [ ] Approved properties can be exposed publicly in V2
