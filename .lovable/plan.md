

# PRD & Technical Reference Document: Xaman Wallet Integration & Crypto-Native Features

This is a documentation deliverable, not a code change. I will create two markdown files in the project root that comprehensively capture every crypto-native feature, architecture decision, API contract, and database schema so you can reference them when rebuilding in a new project.

---

## Deliverable: Two Documents

### 1. `docs/PRD.md` — Product Requirements Document

Covers the **what** and **why**:

- **Product Overview**: XRPL-native real estate tokenization platform with wallet-first authentication (no email/password)
- **User Stories & Flows**:
  - Wallet connection via Xaman QR sign-in (no custodial keys)
  - Multi-wallet management (add, switch, rename, remove, disconnect all)
  - Portfolio view with live on-chain XRP balance, IOU/trustline holdings, and transaction history
  - Shareable read-only portfolio URLs (`/portfolio?account=rXXX`)
  - Send XRP: unified 5-step flow (Asset Select → Form → Review → QR Sign → Receipt)
  - Send IOU tokens: same flow with trustline validation, decimal-safe balance checks, and issuer freeze detection
  - Receive: QR code display with address copy and network warning
  - Audit logging of all wallet lifecycle events
- **Security Requirements**:
  - Server-side wallet ownership verification before building any payment transaction (checks `wallet_profiles` table)
  - No private keys ever touch the application; all signing happens in Xaman app
  - Fire-and-forget audit trail for connect/disconnect/switch events with IP and user-agent capture
- **Non-functional Requirements**:
  - 15s stale time / 5m GC on React Query for instant wallet toggling
  - 10s server-side edge function cache to protect XRPL nodes from hammering
  - 30s background auto-refresh for active wallet data

### 2. `docs/TECHNICAL_SPEC.md` — Technical Architecture Document

Covers the **how** with full implementation details:

**A. Edge Functions (7 total)**

| Function | Purpose | Key inputs | Key outputs |
|---|---|---|---|
| `xaman-create-payload` | Creates Xaman SignIn payload, stores in `xaman_payloads` table | none | `uuid`, `qr_code`, `websocket_url` |
| `xaman-check-payload` | Polls Xaman API for sign status, upserts `wallet_profiles` | `uuid` | `signed`, `wallet_address`, `cancelled`, `expired` |
| `xaman-send-payment` | Creates Xaman Payment payload for QR signing | `tx_json` | `uuid`, `qr_code` |
| `xrpl-account-data` | Fetches live XRPL data (balance, trustlines, txs) with 10s in-memory cache | `wallet_address` | `xrp_balance`, `token_holdings[]`, `transactions[]` |
| `xrpl-build-payment` | Validates + builds XRP Payment tx JSON (reserve-aware) | `from_address`, `to_address`, `amount_xrp`, `destination_tag?`, `memo?` | `tx_json`, `fee_xrp`, `spendable_xrp`, `warnings[]` |
| `xrpl-build-token-payment` | Validates + builds IOU Payment tx JSON (trustline + balance check) | `from_address`, `to_address`, `currency`, `issuer`, `amount`, `destination_tag?`, `memo?` | `tx_json`, `fee_xrp`, `sender_balance`, `warnings[]` |
| `wallet-audit-log` | Inserts audit events | `wallet_address`, `event_type`, `metadata?` | `success` |

**B. Database Tables (crypto-specific)**

| Table | Purpose | Key columns |
|---|---|---|
| `wallet_profiles` | Xaman-verified wallet identities | `wallet_address` (unique), `display_name`, `avatar_url`, `last_login` |
| `xaman_payloads` | Sign-in payload tracking | `uuid`, `status` (pending/signed/cancelled/expired), `wallet_address`, `signed_at` |
| `wallet_audit_log` | Immutable event trail | `wallet_address`, `event_type`, `metadata` (jsonb), `ip_hint`, `user_agent` |

**C. Frontend Architecture**

- **`ActiveWalletContext`** — Global React context managing multi-wallet state in localStorage. Keys: `accountabul_wallets` (array), `accountabul_active_wallet` (string). Handles migration from legacy single-wallet storage. Fires audit log events on connect/disconnect/switch.
- **`useXRPLPortfolio` hook** — React Query wrapper calling `xrpl-account-data`. Returns typed `XRPLPortfolioData` with `xrp_balance`, `token_holdings[]`, `transactions[]`. Query key: `['xrpl_portfolio', walletAddress]`.
- **`WalletConnectModal`** — Xaman QR sign-in flow with 2s polling, 5m timeout.
- **`WalletSelector`** — Popover dropdown for multi-wallet switching, renaming, removing.
- **`SendModal`** — 5-step unified send flow supporting XRP and IOU tokens. Uses `xrpl-build-payment` or `xrpl-build-token-payment` for validation, then `xaman-send-payment` for QR signing.
- **`ReceiveModal`** — QR code (via `qrcode.react`) + address copy + network warning.
- **`PortfolioSection`** — Renders live on-chain data with read-only mode support via `overrideAddress` prop.

**D. API Contracts & Validation Rules**

- XRPL address regex: `/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/`
- Destination tag: integer 0–4294967295
- Memo: max 300 chars, hex-encoded as MemoType + MemoData
- IOU amounts: string-based decimal comparison (no floating point), max 15 significant digits
- XRP reserves: 10 XRP base + 2 XRP per owner object
- All payment builds verify `wallet_profiles` ownership (403 if unverified)
- Transaction `LastLedgerSequence` set to `validated_ledger + 30`

**E. External Dependencies**

- Xaman API: `https://xaman.app/api/v1/platform/payload` (requires `XAMAN_API_KEY` + `XAMAN_API_SECRET`)
- XRPL Node: `https://xrplcluster.com` (public, no auth)
- XRPL RPC methods used: `account_info`, `account_lines`, `account_tx`, `server_info`

**F. Known Limitations / Gaps for V2**

- No WebSocket-based real-time payload status (uses 2s HTTP polling)
- No destination trustline pre-check for IOU sends (warning only)
- No MPT (Multi-Purpose Token) support in portfolio display yet
- No transaction history persistence in database (reads ledger only, limited to 20 recent)
- Single-tenant architecture (no user isolation beyond wallet address)
- No rate limiting on edge functions
- Audit log has no retention policy

---

## Implementation

I will create both documents as markdown files at `docs/PRD.md` and `docs/TECHNICAL_SPEC.md` with the full content outlined above, including exact API request/response schemas, database DDL references, and component prop interfaces.

