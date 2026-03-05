# Technical Specification: Xaman Wallet Integration & Crypto-Native Features

> **Version**: 1.0  
> **Date**: 2026-03-05  
> **Stack**: React 18 + Vite + TypeScript + Tailwind CSS + Supabase Edge Functions (Deno)  
> **Network**: XRPL Mainnet

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Edge Functions](#2-edge-functions)
3. [Database Schema (DDL)](#3-database-schema-ddl)
4. [Frontend Architecture](#4-frontend-architecture)
5. [API Contracts](#5-api-contracts)
6. [External Dependencies](#6-external-dependencies)
7. [File Inventory](#7-file-inventory)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│                                                          │
│  ActiveWalletContext ←→ localStorage (multi-wallet)      │
│  useXRPLPortfolio   ←→ React Query (15s stale/5m gc)    │
│  SendModal / ReceiveModal / WalletSelector               │
│  WalletConnectModal (Xaman QR sign-in)                  │
└────────────────────┬────────────────────────────────────┘
                     │ supabase.functions.invoke()
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase Edge Functions (Deno)              │
│                                                          │
│  xaman-create-payload  ──→  Xaman API (POST payload)    │
│  xaman-check-payload   ──→  Xaman API (GET payload/:id) │
│  xaman-send-payment    ──→  Xaman API (POST payload)    │
│  xrpl-account-data     ──→  XRPL Node (JSON-RPC)       │
│  xrpl-build-payment    ──→  XRPL Node + DB verify      │
│  xrpl-build-token-payment → XRPL Node + DB verify      │
│  wallet-audit-log      ──→  Supabase DB insert          │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    Xaman API    XRPL Node   Supabase DB
   (xaman.app)  (xrplcluster)  (Postgres)
```

---

## 2. Edge Functions

### 2.1 `xaman-create-payload`

**Purpose**: Creates a Xaman SignIn payload for QR-based wallet authentication.

**Runtime**: Deno (`Deno.serve`)  
**Auth**: No JWT verification required (public endpoint)

**Environment Variables**:
- `XAMAN_API_KEY` — Xaman platform API key
- `XAMAN_API_SECRET` — Xaman platform API secret
- `SUPABASE_URL` — Auto-provided
- `SUPABASE_ANON_KEY` — Auto-provided

**Request**: `POST` with empty body `{}`

**Logic**:
1. Validate `XAMAN_API_KEY` and `XAMAN_API_SECRET` are present
2. Build Xaman payload:
   ```json
   {
     "txjson": { "TransactionType": "SignIn" },
     "options": { "submit": false, "expire": 300 },
     "custom_meta": { "identifier": "signin_{timestamp}", "blob": { "purpose": "SIGN_IN" } }
   }
   ```
3. POST to `https://xaman.app/api/v1/platform/payload` with `X-API-Key` and `X-API-Secret` headers
4. Store payload reference in `xaman_payloads` table with status `pending`
5. Return `uuid`, `qr_code` (PNG URL), `websocket_url`

**Response**:
```json
{
  "success": true,
  "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "qr_code": "https://xaman.app/sign/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx_q.png",
  "websocket_url": "wss://xaman.app/sign/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

---

### 2.2 `xaman-check-payload`

**Purpose**: Polls Xaman API for payload sign status; on success, upserts wallet profile.

**Request**: `POST { "uuid": "..." }`

**Logic**:
1. GET `https://xaman.app/api/v1/platform/payload/{uuid}` with API credentials
2. Check `meta.signed`, `meta.cancelled`, `meta.expired`
3. If signed:
   - Extract `response.account` (wallet address)
   - Update `xaman_payloads` → status `signed`, set `wallet_address` and `signed_at`
   - Upsert `wallet_profiles`: insert new profile or update `last_login`
4. If cancelled/expired: update `xaman_payloads` status accordingly

**Response**:
```json
{
  "success": true,
  "status": "signed",
  "signed": true,
  "wallet_address": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "expired": false,
  "cancelled": false
}
```

---

### 2.3 `xaman-send-payment`

**Purpose**: Creates a Xaman Payment payload for QR signing (used after `xrpl-build-payment` or `xrpl-build-token-payment`).

**Request**: `POST { "tx_json": { ... } }`

**Logic**:
1. Validate `tx_json.TransactionType === 'Payment'`
2. Build Xaman payload with `submit: true` and `expire: 300`
3. POST to Xaman API
4. Return `uuid`, `qr_code`, `websocket_url`

**Response**:
```json
{
  "success": true,
  "uuid": "...",
  "qr_code": "https://...",
  "websocket_url": "wss://..."
}
```

---

### 2.4 `xrpl-account-data`

**Purpose**: Fetches live on-chain data for a wallet address.

**Runtime**: Deno (`serve` from std)  
**Caching**: In-memory `Map` with 10-second TTL, max 100 entries with LRU eviction on expired keys.

**Request**: `POST { "wallet_address": "rXXXX..." }`

**Logic**:
1. Check in-memory cache (`account:{address}`)
2. If miss, fire 3 parallel XRPL JSON-RPC requests:
   - `account_info` — XRP balance (in drops)
   - `account_lines` — trustlines/IOU holdings
   - `account_tx` — last 20 transactions
3. Parse responses:
   - Balance: `drops / 1_000_000`
   - Tokens: filter `account_lines` for non-zero balances
   - Transactions: extract type, direction (based on `Destination === wallet_address`), amount, currency, date (XRPL epoch + 946684800 → Unix), fee, result
4. Cache and return

**XRPL Date Conversion**: `new Date((tx.date + 946684800) * 1000).toISOString()`

**Response**:
```json
{
  "xrp_balance": 1234.567890,
  "token_holdings": [
    { "currency": "USD", "issuer": "rXXX...", "balance": 100.50, "limit": 1000000 }
  ],
  "transactions": [
    {
      "hash": "ABCDEF...",
      "type": "Payment",
      "direction": "sent",
      "amount": 50.0,
      "currency": "XRP",
      "date": "2026-03-01T12:00:00.000Z",
      "fee": 0.000012,
      "destination": "rYYYY...",
      "result": "tesSUCCESS"
    }
  ],
  "account": "rXXXX..."
}
```

**Cache Header**: `X-Cache: HIT` or `X-Cache: MISS`

---

### 2.5 `xrpl-build-payment`

**Purpose**: Validates inputs and builds an XRP Payment transaction JSON.

**Request**:
```json
{
  "from_address": "rXXXX...",
  "to_address": "rYYYY...",
  "amount_xrp": "10.5",
  "destination_tag": "12345",
  "memo": "Payment for services"
}
```

**Logic**:
1. **Validate** addresses (regex), amount (positive, ≤ 100B), destination tag (0–4294967295), memo (≤ 300 chars)
2. **Verify wallet ownership**: query `wallet_profiles` for `from_address` → 403 if not found
3. **Cannot send to self**
4. **Fetch** `account_info` + `server_info` in parallel from XRPL
5. **Calculate reserves**: `10 + (OwnerCount × 2)` XRP
6. **Check spendable balance**: `balance - reserve ≥ amount`
7. **Build tx_json**:
   ```json
   {
     "TransactionType": "Payment",
     "Account": "rXXXX...",
     "Destination": "rYYYY...",
     "Amount": "10500000",
     "Fee": "12",
     "LastLedgerSequence": 12345678,
     "DestinationTag": 12345,
     "Memos": [{ "Memo": { "MemoType": "746578742F706C61696E", "MemoData": "..." } }]
   }
   ```
8. **Amount**: Converted to drops (string): `Math.round(amount * 1_000_000)`
9. **Memo encoding**: `Buffer.from(text, 'utf8').toString('hex').toUpperCase()`
10. **Warnings**: "spendable balance will be very low" if remaining < 1 XRP

**Response**:
```json
{
  "success": true,
  "tx_json": { ... },
  "fee_drops": "12",
  "fee_xrp": 0.000012,
  "balance_xrp": 1234.56,
  "spendable_xrp": 1214.56,
  "reserve_xrp": 20,
  "warnings": []
}
```

---

### 2.6 `xrpl-build-token-payment`

**Purpose**: Validates and builds an IOU/token Payment transaction.

**Request**:
```json
{
  "from_address": "rXXXX...",
  "to_address": "rYYYY...",
  "currency": "USD",
  "issuer": "rZZZZ...",
  "amount": "100.50",
  "destination_tag": null,
  "memo": ""
}
```

**Additional Validations** (beyond XRP payment):
- `currency`: required string
- `issuer`: valid XRPL address
- `amount`: positive decimal string, max 15 significant digits
- **Trustline check**: `account_lines` with `peer: issuer` filter → must find matching `currency + account`
- **Freeze check**: if `matchingLine.freeze_peer` → error `TOKEN_FROZEN`
- **Authorization check**: if `matchingLine.authorized === false` → warning
- **Balance check**: decimal-safe string comparison (`compareDecimalStrings`)

**Decimal-Safe Comparison Algorithm**:
```typescript
function compareDecimalStrings(a: string, b: string): number {
  // Pad integer parts to 40 chars, equalize decimal lengths
  // Compare as strings (lexicographic = numeric for equal-length padded numbers)
  // Handle negative signs
}
```

**IOU Amount Format** (in tx_json):
```json
{
  "Amount": {
    "currency": "USD",
    "issuer": "rZZZZ...",
    "value": "100.50"
  }
}
```

**Memo Encoding** (Deno-compatible, no Buffer):
```typescript
new TextEncoder().encode(text).reduce(
  (s, b) => s + b.toString(16).toUpperCase().padStart(2, '0'), ''
)
```

**Response**:
```json
{
  "success": true,
  "tx_json": { ... },
  "fee_drops": "12",
  "fee_xrp": 0.000012,
  "sender_balance": "500.25",
  "currency": "USD",
  "issuer": "rZZZZ...",
  "warnings": ["Ensure the recipient has a trustline for this token..."]
}
```

---

### 2.7 `wallet-audit-log`

**Purpose**: Inserts audit events for wallet lifecycle tracking.

**Request**:
```json
{
  "wallet_address": "rXXXX...",
  "event_type": "connect",
  "metadata": { "is_new": true, "label": "Primary" }
}
```

**Valid event types**: `connect`, `disconnect`, `switch_to`, `switch_from`, `disconnect_all`

**Captures from headers**: `user-agent`, `x-forwarded-for` (first IP)

**Uses**: `SUPABASE_SERVICE_ROLE_KEY` for insert (bypasses RLS)

---

## 3. Database Schema (DDL)

```sql
-- Wallet identity (created on first Xaman sign-in)
CREATE TABLE public.wallet_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz DEFAULT now()
);

ALTER TABLE public.wallet_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read wallet profiles" ON public.wallet_profiles FOR SELECT USING (true);
CREATE POLICY "Anon can insert wallet profiles" ON public.wallet_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update wallet profiles" ON public.wallet_profiles FOR UPDATE USING (true);

-- Xaman payload tracking
CREATE TABLE public.xaman_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  wallet_address text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.xaman_payloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert xaman payloads" ON public.xaman_payloads FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can select xaman payloads" ON public.xaman_payloads FOR SELECT USING (true);
CREATE POLICY "Anon can update xaman payloads" ON public.xaman_payloads FOR UPDATE USING (true);

-- Immutable audit trail
CREATE TABLE public.wallet_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_hint text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert audit logs" ON public.wallet_audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read audit logs" ON public.wallet_audit_log FOR SELECT USING (true);
```

---

## 4. Frontend Architecture

### 4.1 `ActiveWalletContext` (`src/contexts/ActiveWalletContext.tsx`)

Global React context providing multi-wallet state management.

**State**:
- `wallets: ConnectedWallet[]` — all connected wallets
- `activeAddress: string | null` — currently active wallet address
- `isConnectModalOpen: boolean` — controls WalletConnectModal visibility

**localStorage Keys**:
- `accountabul_wallets` — JSON array of `ConnectedWallet` objects
- `accountabul_active_wallet` — active wallet address string

**Key Behaviors**:
- **Legacy migration**: On mount, checks for old `wallet_address` key and migrates to new format
- **Reconciliation**: If active address no longer in wallet list, falls back to first wallet
- **Audit logging**: Fires `logAuditEvent()` (fire-and-forget) on connect, disconnect, switch, disconnect_all

**Exported Hook**: `useActiveWallet()` — throws if used outside provider

```typescript
interface ActiveWalletContextType {
  wallets: ConnectedWallet[];
  activeWallet: ConnectedWallet | null;
  activeAddress: string | null;
  isConnected: boolean;
  setActiveWallet: (address: string) => void;
  addWallet: (address: string, label?: string) => void;
  removeWallet: (address: string) => void;
  renameWallet: (address: string, newLabel: string) => void;
  disconnectAll: () => void;
  isConnectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  onWalletConnected: (address: string) => void;
}
```

### 4.2 `useXRPLPortfolio` Hook (`src/hooks/useXRPLPortfolio.ts`)

React Query wrapper for fetching on-chain wallet data.

```typescript
const { data, isLoading, error } = useXRPLPortfolio(walletAddress);
```

**Query Configuration**:
- `queryKey`: `['xrpl_portfolio', walletAddress]`
- `enabled`: `!!walletAddress`
- `staleTime`: 15,000ms
- `gcTime`: 300,000ms (5 minutes)
- `refetchInterval`: 30,000ms
- `refetchOnWindowFocus`: false

**Return Type**:
```typescript
interface XRPLPortfolioData {
  xrp_balance: number;
  token_holdings: XRPLTokenHolding[];
  transactions: XRPLTransaction[];
  account: string;
}

interface XRPLTokenHolding {
  currency: string;  // 3-char or 40-char hex
  issuer: string;
  balance: number;
  limit: number;
}

interface XRPLTransaction {
  hash: string;
  type: string;
  direction: 'sent' | 'received';
  amount: number;
  currency: string;
  date: string | null;
  fee: number;
  destination: string | null;
  result: string | null;
}
```

### 4.3 `WalletConnectModal` (`src/components/WalletConnectModal.tsx`)

**Props**: `isOpen`, `onClose`, `onWalletConnected(address)`

**Steps**: `select` → `qr` → `success` | `error`

**Key Details**:
- Calls `xaman-create-payload` to get QR code
- Polls `xaman-check-payload` every 2 seconds
- 5-minute timeout with cleanup
- State fully resets on close

### 4.4 `WalletSelector` (`src/components/WalletSelector.tsx`)

Popover dropdown for wallet management. Only renders when a wallet is connected.

**Features**:
- Active wallet indicator (checkmark)
- Inline rename (click pencil → input → Enter/checkmark)
- Remove individual wallets (X button)
- "Add Wallet" opens WalletConnectModal
- "Disconnect All" clears everything

**Note**: Uses `<div role="button">` as PopoverTrigger child to avoid nested `<button>` DOM warning.

### 4.5 `SendModal` (`src/components/SendModal.tsx`)

**Props**: `isOpen`, `onClose`, `walletAddress`, `xrpBalance?`, `tokenHoldings?`

**Steps**: `select-asset` → `form` → `review` → `signing` → `success` | `error`

**Asset Selection**: Searchable list of XRP + all IOU tokens with non-zero balance. Hex currencies decoded for display.

**Form Validation** (client-side):
- Address regex: `/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/`
- Amount: positive, not NaN, within balance for tokens
- Destination tag: integer 0–4294967295 (when toggled on)

**Build → Sign Flow**:
1. Click "Continue" → calls `xrpl-build-payment` or `xrpl-build-token-payment`
2. Review step shows all details + warnings
3. Click "Sign with Xaman" → calls `xaman-send-payment`
4. QR displayed, 2s polling on `xaman-check-payload`
5. Success: shows tx hash with Explorer link
6. Error: shows message with retry option

### 4.6 `ReceiveModal` (`src/components/ReceiveModal.tsx`)

**Props**: `isOpen`, `onClose`, `walletAddress`

**Renders**: QR code (SVG via `qrcode.react`, size 200, level "H"), full address with copy button, network badge, cross-network warning.

### 4.7 `PortfolioSection` (`src/components/PortfolioSection.tsx`)

**Props**: `overrideAddress?`, `isReadOnly?`

**Logic**:
- If `overrideAddress` provided, uses that; otherwise uses `activeAddress` from context
- Read-only mode hides Send/Receive buttons
- Shows 3 summary cards (XRP balance, token count, transaction count)
- Token holdings list with decoded currency names
- Transaction list with direction icons, status badges, and Explorer links

### 4.8 Portfolio Page (`src/pages/Portfolio.tsx`)

- Route: `/portfolio`
- Supports `?account=rXXXX` query parameter for shareable URLs
- Determines read-only mode by comparing `?account` with `activeAddress`

---

## 5. API Contracts

### 5.1 XRPL Address Validation
```
/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/
```

### 5.2 Destination Tag
- Type: unsigned 32-bit integer
- Range: 0–4,294,967,295
- Optional (toggled via UI switch)

### 5.3 Memo
- Max length: 300 characters
- Encoding: UTF-8 → hex uppercase
- MemoType: `746578742F706C61696E` (hex of "text/plain")

### 5.4 XRP Amount
- Stored on-ledger in drops (1 XRP = 1,000,000 drops)
- Conversion: `Math.round(amount * 1_000_000)` → string

### 5.5 IOU Amount
- Passed as string (no floating point conversion)
- Max 15 significant digits
- Comparison uses decimal-safe string algorithm

### 5.6 XRPL Reserves
- Base reserve: 10 XRP
- Owner reserve: 2 XRP per owned object (trustlines, offers, etc.)
- Spendable = balance − (10 + 2 × OwnerCount)
- **Note**: These values are hardcoded; V2 should query `server_info.validated_ledger.reserve_base` and `reserve_inc`

### 5.7 Transaction Expiry
- `LastLedgerSequence` = `server_info.validated_ledger.seq + 30`
- Approximately 2 minutes window

### 5.8 Network Fee
- Hardcoded: 12 drops (0.000012 XRP)
- **Note**: V2 should use dynamic fee from `server_info`

---

## 6. External Dependencies

### 6.1 Xaman API
- **Base URL**: `https://xaman.app/api/v1/platform/payload`
- **Auth**: `X-API-Key` + `X-API-Secret` headers
- **Endpoints Used**:
  - `POST /` — Create payload (SignIn or Payment)
  - `GET /{uuid}` — Check payload status
- **Secrets Required**: `XAMAN_API_KEY`, `XAMAN_API_SECRET` (stored in Supabase edge function secrets)
- **Documentation**: https://docs.xaman.dev/

### 6.2 XRPL Public Node
- **URL**: `https://xrplcluster.com`
- **Protocol**: JSON-RPC over HTTPS
- **Auth**: None (public)
- **RPC Methods Used**:
  - `account_info` — Balance, sequence, owner count
  - `account_lines` — Trustlines/IOU balances (supports `peer` filter)
  - `account_tx` — Transaction history (limit: 20)
  - `server_info` — Validated ledger index, reserves
- **Alternative Nodes**: `https://s1.ripple.com:51234`, `https://s2.ripple.com:51234`

### 6.3 NPM Packages (Crypto-Specific)
- `qrcode.react@^4.2.0` — QR code generation for receive modal
- `@supabase/supabase-js@^2.98.0` — Edge function invocation

---

## 7. File Inventory

### Edge Functions (Supabase)
| File | Lines | Purpose |
|---|---|---|
| `supabase/functions/xaman-create-payload/index.ts` | 130 | Xaman SignIn payload creation |
| `supabase/functions/xaman-check-payload/index.ts` | 139 | Payload status polling + profile upsert |
| `supabase/functions/xaman-send-payment/index.ts` | 84 | Xaman Payment payload creation |
| `supabase/functions/xrpl-account-data/index.ts` | 144 | Live XRPL data with in-memory cache |
| `supabase/functions/xrpl-build-payment/index.ts` | 190 | XRP payment build + validation |
| `supabase/functions/xrpl-build-token-payment/index.ts` | 220 | IOU payment build + validation |
| `supabase/functions/wallet-audit-log/index.ts` | 57 | Audit event insertion |

### Frontend Components
| File | Lines | Purpose |
|---|---|---|
| `src/contexts/ActiveWalletContext.tsx` | 217 | Multi-wallet state management |
| `src/hooks/useXRPLPortfolio.ts` | 51 | React Query hook for on-chain data |
| `src/components/WalletConnectModal.tsx` | 219 | Xaman QR sign-in flow |
| `src/components/WalletSelector.tsx` | 163 | Multi-wallet popover dropdown |
| `src/components/SendModal.tsx` | 542 | 5-step unified send flow |
| `src/components/ReceiveModal.tsx` | 88 | QR receive modal |
| `src/components/PortfolioSection.tsx` | 224 | Portfolio display component |
| `src/pages/Portfolio.tsx` | 28 | Portfolio route with shareable URLs |

### CORS Headers (Standard Across All Edge Functions)
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

### Edge Function Config (supabase/config.toml)
All edge functions that receive external requests (Xaman webhooks) should have:
```toml
[functions.function-name]
verify_jwt = false
```
