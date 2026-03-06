# Architecture Overview — Property Web3 Portal (RWA)

> **Status**: Prototype / V1 reference
> **Purpose**: Document the current system for use in a spec-driven V2 rebuild
> **Last Updated**: 2026-03-06

---

## 1. System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite + TS)                   │
│                                                                   │
│  Pages: Index, Auth, Dashboard, Portfolio, Marketplace,          │
│         Tokenize, Mint, PropertyDetail, AIAgents, Professionals  │
│                                                                   │
│  Global State:                                                    │
│    ThemeProvider (next-themes)                                    │
│    QueryClientProvider (React Query)                              │
│    ActiveWalletProvider (custom context)                          │
│                                                                   │
│  Key Components:                                                  │
│    WalletConnectModal → Xaman QR sign-in flow                    │
│    WalletSelector     → Multi-wallet popover dropdown            │
│    SendModal          → 6-step XRP/IOU send flow                 │
│    ReceiveModal        → QR address display                       │
│    MintWizard         → 3-step token mint (NFT / MPT / IOU)     │
│    PortfolioSection   → Live XRPL data display                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ supabase.functions.invoke()
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Edge Functions (Deno runtime)              │
│                                                                   │
│  Auth / Wallet:                                                   │
│    xaman-create-payload   → create SignIn QR payload             │
│    xaman-check-payload    → poll signing status + upsert profile │
│    xaman-send-payment     → create Payment QR payload            │
│    wallet-audit-log       → insert audit events                  │
│                                                                   │
│  XRPL Data:                                                       │
│    xrpl-account-data      → fetch live account data (cached)    │
│    xrpl-build-payment     → build + validate XRP payment tx      │
│    xrpl-build-token-payment → build + validate IOU payment tx   │
│    xrpl-build-mint        → build NFT / MPT / IOU issuance tx   │
│    xrpl-submit-signed     → server-side sign + submit (testnet) │
│    xrpl-testnet-faucet    → generate funded testnet wallet       │
│    xrpl-token-meta        → fetch token metadata                 │
│                                                                   │
│  Property:                                                        │
│    tokenization-pipeline  → property intake CRUD + admin review  │
│    places-autocomplete    → Google Places address suggestions    │
│    places-details         → Google Places address fill           │
└──────────────┬───────────────────┬───────────────────┬──────────┘
               │                   │                   │
          Xaman API           XRPL Nodes          Supabase DB
       (xaman.app)         (mainnet/testnet)      (Postgres)
```

---

## 2. Authentication Model

This app has **two independent identity systems** that must both be satisfied:

| Layer | System | Identity | Storage |
|---|---|---|---|
| App Auth | Supabase Auth (email/Google) | `auth.users.id` (UUID) | Session cookie / JWT |
| Wallet Auth | Xaman QR sign-in | XRPL `r-address` | `user_wallets` DB table + localStorage |

**How they connect**: A wallet row in `user_wallets` has `user_id` (FK to `auth.users`). A user must be logged in via Supabase Auth to add or manage wallets. Wallet-only actions (viewing portfolio, sending) only require a connected wallet address.

**Important**: Neither system validates the other. There is no check that a Supabase Auth user owns a given XRPL address — Xaman signing is the proof of wallet ownership.

See `docs/AUTH_SYSTEM.md` for full details.

---

## 3. Database Tables

| Table | Purpose | RLS |
|---|---|---|
| `auth.users` | Supabase Auth identity (managed by Supabase) | Supabase-managed |
| `profiles` | Extended user profile (name, avatar, Google data) | User owns their row |
| `user_wallets` | Wallets linked to a user (includes `wallet_secret` for testnet) | User owns their rows |
| `user_wallets_safe` | View of `user_wallets` excluding `wallet_secret` | Same as `user_wallets` |
| `wallet_profiles` | Legacy: wallet-first identity (no Supabase Auth) | Open read/write |
| `xaman_payloads` | Xaman payload tracking (pending → signed/cancelled) | Open read/write |
| `wallet_audit_log` | Immutable audit trail of wallet events | Insert + read all |
| `properties` | Property tokenization submissions | Owner read/write, admin all |
| `token_mints` | Record of mint operations (pending/validated/failed) | User owns their rows |
| `token_logos` | Supabase Storage bucket for token images | Public read |

---

## 4. Token Types Supported

| Type | Standard | Network | Signing |
|---|---|---|---|
| NFT | XLS-20 | Mainnet + Testnet | Xaman QR (mainnet), auto-sign (testnet) |
| MPT | XLS-33 / XLS-89 metadata | Testnet (mainnet pending XRPL activation) | Xaman QR (mainnet), auto-sign (testnet) |
| IOU Trust Line | Native XRPL | Mainnet + Testnet | Xaman QR (mainnet), auto-sign (testnet) |

**MPT metadata standard**: XLS-89 compressed JSON (≤1024 bytes). Keys are abbreviated (`n`=name, `t`=ticker, `i`=image, `d`=description, `ac`=asset_class, `as`=asset_subclass, `in`=issuer_name, `us`=uris, `ai`=additional_info).

---

## 5. Key Data Flows

### 5.1 Wallet Connect (Xaman)
```
User clicks Connect → [xaman-create-payload] → QR code displayed
→ User scans with Xaman app → [xaman-check-payload] polls every 2s
→ On signed: wallet_address extracted → user_wallets upserted
→ ActiveWalletContext updated → WalletConnectModal closes
```

### 5.2 XRPL Portfolio Load
```
activeAddress changes → useXRPLPortfolio(address, network) triggered
→ [xrpl-account-data] called → checks in-memory cache (30s TTL)
→ If miss: 5 sequential XRPL JSON-RPC calls with 100ms delays
  (account_info, account_lines, account_tx, mpt_issuances, mpt_holdings)
→ Parsed and returned → React Query caches (30s stale, 5m gc, 90s refetch)
```

### 5.3 MPT Mint (Testnet auto-sign)
```
User fills MPTForm → MintWizard review step
→ [xrpl-build-mint] builds MPTokenIssuanceCreate tx_json
→ wallet provider === 'testnet_faucet' → [xrpl-submit-signed]
  → edge function fetches wallet_secret from user_wallets
  → signs tx locally → submits to testnet
→ token_mints record updated to 'validated'
```

### 5.4 MPT Mint (Mainnet Xaman)
```
→ [xrpl-build-mint] builds tx_json
→ [xaman-send-payment] creates Xaman payload
→ QR displayed → user signs in Xaman app
→ [xaman-check-payload] polls every 3s
→ On signed: token_mints updated to 'validated'
```

### 5.5 Property Tokenization Intake
```
User fills /tokenize form → [tokenization-pipeline] edge function
→ Upserts into properties table with status='draft'
→ User submits → status='submitted'
→ Admin reviews → status cycles: under_review → approved/rejected
```

---

## 6. XRPL Node Infrastructure

**Mainnet nodes** (in order, with failover):
1. `https://s2.ripple.com:51234`
2. `https://s1.ripple.com:51234`
3. `https://xrplcluster.com`

**Testnet nodes**:
1. `https://s.altnet.rippletest.net:51234`
2. `https://testnet.xrpl-labs.com`

**Failover logic**: Each edge function that calls XRPL uses a `xrplRequest()` helper that iterates nodes in order, retrying up to 2 times per node on 429/503 errors before moving to the next node.

---

## 7. External Services

| Service | Purpose | Auth Method |
|---|---|---|
| Xaman API (`xaman.app`) | Wallet signing payloads | `X-API-Key` + `X-API-Secret` headers |
| XRPL Public Nodes | Live ledger data | None (public) |
| Google Places API | Address autocomplete | `GOOGLE_PLACES_API_KEY` env var |
| Supabase Storage | Token logo images | Supabase anon key (public bucket) |
| Bithomp CDN | Token logo lookup by XRPL address | None (public) |
| Unsplash | Test data placeholder images | None (public CDN) |

---

## 8. File Inventory

### Pages
| File | Route | Auth Required |
|---|---|---|
| `pages/Index.tsx` | `/` | No |
| `pages/Auth.tsx` | `/auth` | No (redirects if logged in) |
| `pages/ResetPassword.tsx` | `/reset-password` | No |
| `pages/Dashboard.tsx` | `/dashboard` | Supabase Auth |
| `pages/Portfolio.tsx` | `/portfolio?account=rXXX` | No (read-only if no wallet) |
| `pages/Marketplace.tsx` | `/marketplace` | No |
| `pages/PropertyDetail.tsx` | `/property/:id` | No |
| `pages/Tokenize.tsx` | `/tokenize` | Supabase Auth |
| `pages/Mint.tsx` | `/mint` | Supabase Auth + Wallet |
| `pages/Professionals.tsx` | `/professionals` | No |
| `pages/AIAgents.tsx` | `/ai-agents` | No |

### Core Components
| File | Purpose |
|---|---|
| `components/WalletConnectModal.tsx` | Xaman QR sign-in, steps: select → qr → success/error |
| `components/WalletSelector.tsx` | Multi-wallet popover dropdown |
| `components/SendModal.tsx` | 6-step send flow (select-asset → form → review → signing → success/error) |
| `components/ReceiveModal.tsx` | QR display for receiving funds |
| `components/PortfolioSection.tsx` | Portfolio display (holdings, transactions, MPT issuances) |
| `components/Navigation.tsx` | Main nav + mobile hamburger menu |
| `components/QRScanner.tsx` | Camera-based QR code scanner (for destination address) |
| `components/AddressAutocomplete.tsx` | Google Places address input |
| `components/ThemeToggle.tsx` | Dark/light mode switch |

### Mint Components
| File | Purpose |
|---|---|
| `components/mint/MintWizard.tsx` | Orchestrates 3-step mint flow |
| `components/mint/MPTForm.tsx` | MPT issuance config form (XLS-89 + RWA metadata) |
| `components/mint/NFTForm.tsx` | NFT (XLS-20) config form |
| `components/mint/IOUForm.tsx` | IOU trust line issuance form |
| `components/mint/MintStatus.tsx` | Status display (pending/signed/validated/failed + QR) |

### Hooks
| File | Purpose |
|---|---|
| `hooks/useAuth.ts` | Supabase Auth session management |
| `hooks/useXRPLPortfolio.ts` | React Query wrapper for xrpl-account-data |
| `hooks/useXRPLSubscription.ts` | WebSocket subscription (real-time ledger events) |
| `hooks/useInactivityTimeout.ts` | 30-min idle timer → auto sign-out |
| `hooks/useProfile.ts` | Fetch/update user profile from DB |
| `hooks/usePortfolio.ts` | Portfolio data from DB (not XRPL) |
| `hooks/useProperties.ts` | Property listings from DB |
| `hooks/usePropertyData.ts` | Single property detail from DB |
| `hooks/useTokenMeta.ts` | Token metadata lookup |
| `hooks/useTokenizeForm.ts` | Tokenization form state management |
| `hooks/useAIAgents.ts` | AI agent listings from DB |
| `hooks/useProfessionals.ts` | Professionals listings from DB |
| `hooks/use-mobile.tsx` | Mobile breakpoint detection |

### Contexts
| File | Purpose |
|---|---|
| `contexts/ActiveWalletContext.tsx` | Global multi-wallet state: wallet list, active wallet, connect modal, inactivity timeout |

### Edge Functions
| Function | Purpose |
|---|---|
| `xaman-create-payload` | Create Xaman SignIn payload |
| `xaman-check-payload` | Poll payload status + upsert wallet profile |
| `xaman-send-payment` | Create Xaman Payment payload |
| `wallet-audit-log` | Insert wallet lifecycle audit events |
| `xrpl-account-data` | Live account data with node failover + cache |
| `xrpl-build-payment` | Validate + build XRP payment tx |
| `xrpl-build-token-payment` | Validate + build IOU payment tx |
| `xrpl-build-mint` | Build NFT/MPT/IOU issuance tx |
| `xrpl-submit-signed` | Server-side sign + submit (testnet faucet wallets) |
| `xrpl-testnet-faucet` | Generate + fund testnet wallet |
| `xrpl-token-meta` | Fetch XRPL token metadata |
| `tokenization-pipeline` | Property intake CRUD + admin pipeline |
| `places-autocomplete` | Google Places autocomplete proxy |
| `places-details` | Google Places detail fetch proxy |
