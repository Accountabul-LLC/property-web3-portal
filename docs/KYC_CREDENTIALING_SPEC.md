# KYC + Wallet Credentialing + Trading Authorization System
## Full Implementation Specification — Accountabul Platform

> **Version**: 1.0
> **Status**: Build-ready spec
> **Scope**: Isolated, modular compliance domain — plugs into broader platform
> **Last Updated**: 2026-03-06

---

## A. Executive Summary

Accountabul is a tokenized real-world asset platform. Regulated tokenized assets — real estate, restricted securities, compliant digital instruments — cannot be freely traded by anonymous or unverified participants. Every jurisdiction that recognizes tokenized securities mandates identity verification, beneficial ownership disclosure, and ongoing transaction monitoring as preconditions to trading.

This document specifies the **KYC + Wallet Credentialing + Trading Authorization System**: the compliance gate that stands between a newly registered user and any trading activity on the platform.

The system enforces a strict sequential authorization pipeline:

```
Account Created
    → KYC Submitted
        → KYC Approved
            → Wallet Registered
                → Wallet Ownership Verified
                    → Wallet Screened (AML/Risk)
                        → Wallet Credential Issued
                            → Trading Authorized
```

No step can be skipped. No client-side state controls trading eligibility. Every decision is enforced at the backend and recorded in an immutable audit trail.

**Key design principles**:
- **Zero trust on the client** — eligibility is computed server-side on every request
- **Separation of concerns** — KYC status, wallet status, and trading eligibility are distinct state machines
- **Modular domain boundary** — this feature is a self-contained compliance domain that emits events consumed by trading, asset, and DEX layers
- **Future-ready** — designed to support on-chain verifiable credentials, permissioned DEX hooks, and issuer-controlled asset acceptance rules
- **Auditability first** — every state transition produces an immutable audit event

---

## B. Core Business Rules

```
RULE-001: A user CANNOT trade unless KYC status = 'approved'
RULE-002: A user CANNOT register a wallet unless KYC status = 'approved'
RULE-003: A wallet CANNOT be used for trading unless wallet_status = 'approved'
RULE-004: A wallet CANNOT reach 'approved' without passing screening
RULE-005: Trading eligibility is derived — never manually set — from KYC + wallet states
RULE-006: Eligibility is evaluated server-side on every protected API call
RULE-007: A wallet credential is REQUIRED for permissioned asset interaction
RULE-008: Credential revocation immediately locks trading — no grace period
RULE-009: A new wallet added by an approved user must complete its own screening before use
RULE-010: Admin overrides are logged with actor, reason, and timestamp — they are not silent
RULE-011: KYC documents are stored encrypted — never in plaintext in the application DB
RULE-012: The same XRPL wallet address cannot be registered by two different users
RULE-013: Wallet ownership must be cryptographically proven before screening begins
RULE-014: Screening results from external providers are stored normalized — not as raw blobs
RULE-015: Re-screening can be triggered by admin or by automated risk signals
```

---

## C. System Modules

### C1. User Account Module

**Purpose**: Manage user identity records and their relationship to downstream compliance state.

**Inputs**: Email, password or OAuth token, optional profile data

**Outputs**: `user_id` (UUID), `account_status` (`active` | `suspended` | `banned`), compliance readiness signal to downstream modules

**Dependencies**: Supabase Auth (or auth provider of choice)

**Failure States**:
- Duplicate email → reject with 409
- OAuth provider failure → fallback to email prompt
- Account suspended mid-session → force sign-out on next token validation

---

### C2. KYC Intake Module

**Purpose**: Collect all PII and documents required for identity verification. Does NOT make KYC decisions.

**Inputs**: Legal name, date of birth, address, nationality, government ID (front/back), selfie/liveness video, tax ID (optional), source of funds declaration

**Outputs**: `kyc_case_id`, list of uploaded `kyc_document` records, `kyc_case.status = 'submitted'`

**Dependencies**: C1 (User Account), secure document storage (encrypted S3 / Supabase Storage with server-side encryption)

**Failure States**:
- Upload fails mid-flow → partial case saved as `draft`, user can resume
- Unsupported file type → reject with clear error
- File too large → reject with size limit message
- User submits without all required fields → validation gate before submission

---

### C3. KYC Provider Integration Module

**Purpose**: Bridge between the platform and a third-party KYC/identity verification provider (Persona, Jumio, Onfido, Synaps, etc.).

**Inputs**: `kyc_case_id`, user PII, document URLs (pre-signed, time-limited)

**Outputs**: Provider reference ID, webhook events (approved/rejected/requires_action), normalized `kyc_decision` record

**Dependencies**: C2 (KYC Intake), secrets manager (API keys), webhook endpoint

**Failure States**:
- Provider API timeout → queue retry with exponential backoff
- Webhook arrives out of order → idempotency check on `provider_reference_id`
- Provider rejects document quality → map to `retry_required` status
- Provider returns unknown status → map to `under_review`, alert compliance team

**Build Now**: Webhook receiver + normalized response schema + status mapper
**Build Later**: Multi-provider fallback, provider scoring comparison

---

### C4. KYC Decision Engine

**Purpose**: Translate raw provider responses into platform KYC status. Applies business rules on top of provider decisions.

**Inputs**: Normalized provider response, internal risk signals (if any), admin override flag

**Outputs**: Updated `kyc_cases.status`, `kyc_status_history` record, `kyc.approved` / `kyc.rejected` domain event

**Dependencies**: C3 (KYC Provider Integration), C12 (Audit Log)

**Decision Logic**:
```
IF provider_result = 'clear' → kyc_status = 'approved'
IF provider_result = 'consider' → kyc_status = 'under_review' (manual)
IF provider_result = 'unidentified' → kyc_status = 'rejected'
IF provider_result = 'caution' + risk_score < threshold → 'under_review'
IF admin_override = true → log override, apply override status
```

**Failure States**:
- Conflicting provider signals → escalate to manual review
- Admin override attempted by non-compliance role → 403

---

### C5. Wallet Registration Module

**Purpose**: Accept a wallet address from an approved KYC user and begin the wallet authorization pipeline.

**Inputs**: `user_id`, `wallet_address` (XRPL r-address), `network` (mainnet/testnet), `provider` (xaman / manual)

**Outputs**: `wallet_id`, `wallet_status = 'pending_verification'`, `wallet.registered` domain event

**Dependencies**: C4 (KYC must be approved), C1 (User Account)

**Guards**:
- KYC not approved → 403 "KYC required before wallet registration"
- Wallet address already registered by another user → 409
- Invalid XRPL address format → 422

**Failure States**:
- DB write fails → rollback, surface error
- User tries to register more than max allowed wallets → 403

---

### C6. Wallet Ownership Verification Module

**Purpose**: Cryptographically prove that the user controls the wallet they are registering. Uses Xaman QR signing (existing infrastructure) or manual challenge-response.

**Inputs**: `wallet_id`, Xaman payload UUID (from signing flow)

**Outputs**: `wallet_verification_events` record, `wallet_status = 'verified'`, `wallet.ownership_verified` event

**Verification Method (Xaman)**:
1. Create a `SignIn` payload via Xaman API (re-use existing `xaman-create-payload` function)
2. User scans QR and signs in Xaman
3. On signed: `response.account` must match registered `wallet_address`
4. If match → ownership confirmed → proceed to screening
5. If mismatch → reject with "Wallet address does not match signed account"

**Failure States**:
- Payload expires (5 min) → user must retry
- Signed address doesn't match registered → reject, log fraud signal
- Xaman API unavailable → queue retry, notify user

---

### C7. Wallet Screening Module

**Purpose**: Submit the verified wallet to AML/risk screening. Orchestrates call to screening engine (external or internal).

**Inputs**: `wallet_id`, `wallet_address`, `network`, transaction history snapshot

**Outputs**: `wallet_screening_result` record, risk score, flag list, `screening_status`

**Dependencies**: C6 (Wallet must be verified), C8 or C9 (screening provider/engine)

**Screening Triggers**:
- Automatic: immediately after wallet ownership verification
- Manual: admin re-triggers screening
- Automated: periodic background re-screening (scheduled job)

**Failure States**:
- Provider unreachable → `screening_status = 'provider_error'`, retry queue
- Wallet has no history → return clean result with low confidence score
- Screening times out → mark as `pending`, poll for result

---

### C8. Wallet Risk Engine (Internal — Build Later)

**Purpose**: Internal rule-based and heuristic system for evaluating wallet risk without relying solely on a third-party provider.

**Inputs**: On-chain transaction history (via `xrpl-account-data`), known risk address lists, graph data

**Outputs**: `risk_score` (0–100), `risk_flags[]`, `related_addresses[]`

**Capabilities (phased)**:
- Phase 1: Basic heuristics (age of wallet, volume, counterparty count)
- Phase 2: Sanctions list matching (OFAC SDN, EU consolidated)
- Phase 3: Transaction graph clustering (wallet → wallet relationships)
- Phase 4: Behavioral anomaly detection (ML-based)

**Build Now**: Schema and interface contract only
**Build Later**: Full engine implementation

---

### C9. External Screening Provider Module

**Purpose**: Integrate with a third-party wallet risk/AML provider (Elliptic, Chainalysis, TRM Labs, Scorechain).

**Inputs**: Wallet address, blockchain (XRPL), optional transaction history

**Outputs**: Normalized `screening_result`: `{ risk_level, risk_score, flags[], sanctions_exposure, cluster_risk, provider_ref }`

**Normalization Contract**:
```typescript
interface NormalizedScreeningResult {
  provider: string;
  provider_ref: string;
  wallet_address: string;
  risk_level: 'low' | 'medium' | 'high' | 'severe';
  risk_score: number;          // 0–100
  sanctions_exposure: boolean;
  flags: WalletRiskFlag[];
  cluster_risk: boolean;
  raw_response_hash: string;   // SHA-256 of raw response for audit
  screened_at: string;         // ISO timestamp
}
```

**Vendor Abstraction**: All provider calls go through a `ScreeningProviderAdapter` interface. Swapping providers requires only a new adapter — no changes to upstream modules.

---

### C10. Credential / Authorization Module

**Purpose**: Issue a platform credential (off-chain, DB-backed) to an approved wallet. This credential is the machine-readable authorization that all trading-layer checks consume.

**Inputs**: `wallet_id`, `user_id`, `screening_result_id`, `kyc_case_id`

**Outputs**: `wallet_credential` record with `status = 'active'`, `credential.issued` domain event

**Credential Fields** (see Section J for full schema)

**Revocation Triggers**:
- Admin action
- KYC expires or is revoked
- Wallet flagged post-approval
- Suspicious activity detected
- User requests account deletion

**Build Now**: DB-backed credential with status tracking
**Build Later**: On-chain verifiable credential (W3C VC standard), Sign In With XRPL-linked credential

---

### C11. Trading Eligibility Engine

**Purpose**: Single source of truth for whether a `(user_id, wallet_id)` pair is eligible to trade. Called on every protected request.

**Inputs**: `user_id`, `wallet_id`

**Outputs**: `{ eligible: boolean, reason: EligibilityCode, locked_gates: string[] }`

**Never cached on the client. Always computed server-side.**

See Section K for full decision logic.

---

### C12. Admin Review Module

**Purpose**: Internal compliance dashboard for reviewing KYC cases, screening results, and flagged wallets.

**Inputs**: Admin actions (approve, reject, override, flag, request_info, revoke, re-screen)

**Outputs**: Status updates, `admin_actions` records, `audit_log` entries, notification events

**Roles**:
- `compliance_reviewer`: can view and recommend, cannot approve
- `compliance_officer`: can approve/reject/override
- `super_admin`: can do anything + view raw data

---

### C13. Audit Log Module

**Purpose**: Immutable event log for all state changes in the compliance domain.

**Inputs**: Event type, actor (`user_id` or `admin_id`), subject (`kyc_case_id`, `wallet_id`, etc.), old state, new state, metadata

**Outputs**: Append-only `audit_logs` rows

**Rules**:
- No UPDATE or DELETE on `audit_logs` — append only
- Each write uses DB-level trigger or service-enforced insert-only
- Stored separately from mutable application data
- Retained for minimum 7 years (regulatory standard)

---

### C14. Notifications Module

**Purpose**: Deliver status updates to users and compliance staff at key state transitions.

**Channels**: Email (transactional), in-app toast/banner, future: SMS, push

**Trigger Events**:
- KYC submitted → "We've received your application"
- KYC approved → "Identity verified — register your wallet"
- KYC rejected → "Action required — see details"
- Wallet screening complete → "Your wallet has been reviewed"
- Trading enabled → "You are now approved to trade"
- Credential revoked → "Your trading access has been suspended"

---

## D. End-to-End User Flows

### D1. Primary Happy Path

```
1. User creates account (email/Google)
   → account_status = 'active'
   → trading_eligibility = 'pending_kyc'

2. User lands on dashboard
   → KYC gate displayed: "Complete identity verification to trade"
   → CTA: "Start Verification"

3. User fills KYC intake form (legal name, DOB, address, nationality)

4. User uploads documents:
   → Government ID (front)
   → Government ID (back)
   → Selfie (liveness or static)
   → [Optional] Proof of address

5. User submits KYC package
   → kyc_case.status = 'submitted'
   → kyc_status_history record created
   → Provider integration triggered

6. KYC under review (async)
   → User sees "Verification in progress" state
   → Provider webhook fires when complete

7. KYC approved
   → kyc_case.status = 'approved'
   → domain event: kyc.approved
   → trading_eligibility = 'pending_wallet'
   → Notification: "Identity verified — next: register wallet"

8. User navigates to Wallet Registration
   → Enters or pastes XRPL wallet address
   → wallet_status = 'pending_verification'

9. Wallet ownership proof (Xaman QR)
   → QR displayed
   → User signs in Xaman app
   → Signed address verified against registered address
   → wallet_status = 'verified'
   → wallet_verification_events record created

10. Wallet screening triggered automatically
    → Screening request sent to provider
    → wallet_screening_results.status = 'pending'
    → trading_eligibility = 'pending_wallet_screening'
    → User sees "Your wallet is being reviewed" state

11. Screening completes (async)
    → Normalized result received
    → Risk level = 'low' → auto-approve path
    → wallet_status = 'approved'
    → wallet_credentials record created (status = 'active')
    → trading_eligibility = 'eligible'
    → Notification: "You are now approved to trade"

12. User can now trade
    → Every protected API call validates eligibility server-side
    → Credential checked on every permissioned asset interaction
```

---

### D2. Alternative Flows

**KYC Rejected**:
```
Provider returns 'rejected' → kyc_case.status = 'rejected'
→ Notification: "Verification failed — reason: [mapped reason]"
→ User can re-submit if policy allows (retry_count < max_retries)
→ trading_eligibility remains 'pending_kyc'
→ If max retries reached → status = 'blocked', admin review required
```

**KYC Pending / Requires Action**:
```
Provider returns 'consider' or 'requires_action'
→ kyc_case.status = 'under_review' or 'retry_required'
→ User prompted to re-upload specific documents
→ Admin can manually approve/reject from compliance dashboard
```

**Wallet Risk Flagged (Medium Risk)**:
```
Screening returns risk_level = 'medium'
→ wallet_screening_results.status = 'review_required'
→ wallet_status = 'under_screening'
→ trading_eligibility = 'pending_manual_review'
→ Compliance officer alerted
→ Officer reviews: approve → credential issued | reject → wallet blocked
```

**Wallet Risk Flagged (High / Severe)**:
```
Screening returns risk_level = 'high' or 'severe'
→ wallet_status = 'rejected'
→ wallet_risk_flags created with flag details
→ trading_eligibility = 'blocked'
→ Notification: "Wallet not approved — contact support"
→ Admin can override with documented reason
```

**Approved User Adds a Second Wallet**:
```
User (KYC approved) registers new wallet address
→ Repeat steps 8–11 for new wallet
→ First wallet remains active during review of second
→ Trading continues on first wallet while second is screened
→ Each wallet has its own credential
→ User can designate active trading wallet
```

**Credential Revoked**:
```
Trigger: admin action, KYC expiry, or risk signal
→ wallet_credentials.status = 'revoked', revoked_at = now()
→ trading_eligibility recalculated → 'suspended' or 'blocked'
→ Notification: "Trading access suspended — reason: [mapped]"
→ All in-flight orders should be cancelled (future DEX integration)
→ Admin_actions record created
```

**Suspicious Activity Detected Post-Approval**:
```
Automated risk signal received (webhook or scheduled scan)
→ wallet_risk_flags record created
→ wallet_credentials.status = 'suspended' (not yet revoked)
→ trading_eligibility = 'suspended'
→ Compliance officer alerted for review
→ Officer decision: restore → credential reactivated | revoke → full revocation
```

**Wallet Changed / Address Substitution Attempt**:
```
User tries to swap wallet address after approval
→ New address must go through full registration + screening pipeline
→ Old wallet credential remains valid until explicitly revoked
→ Admin alerted to address change event
→ audit_logs entry created
```

---

## E. State Machines

### E1. KYC Status

```
States:
  not_started → in_progress → submitted → under_review → approved
                                                       → rejected
                                                       → retry_required
                             → expired (if not submitted within N days)

Transitions:
  not_started   → in_progress    : user starts KYC intake form
  in_progress   → submitted      : user submits complete KYC package
  in_progress   → expired        : N days elapsed without submission
  submitted     → under_review   : provider intake confirmed
  under_review  → approved       : provider returns 'clear' + decision engine approves
  under_review  → rejected       : provider returns 'rejected' + no override
  under_review  → retry_required : provider returns 'consider' / 'requires_action'
  retry_required → submitted     : user re-submits updated documents
  rejected      → submitted      : if retry_count < max_retries AND policy allows
  approved      → expired        : KYC validity period elapsed (e.g., 1 year)
  expired       → submitted      : user re-submits for renewal
  any           → blocked        : max retries exceeded or sanctions match
  any           → approved       : admin override (logged)
  any           → rejected       : admin override (logged)
```

### E2. Wallet Status

```
States:
  unregistered → pending_verification → verified → under_screening
                                                 → approved
                                                 → rejected
                                                 → suspended
                                                 → revoked

Transitions:
  unregistered         → pending_verification : user registers wallet address (requires KYC = approved)
  pending_verification → verified             : ownership proof confirmed via Xaman signing
  pending_verification → unregistered         : verification failed or timed out (user can retry)
  verified             → under_screening      : screening triggered
  under_screening      → approved             : screening returns low/acceptable risk, credential issued
  under_screening      → rejected             : screening returns high/severe risk
  under_screening      → under_screening      : manual review in progress (no state change, flag added)
  approved             → suspended            : risk signal detected post-approval
  approved             → revoked              : admin revokes, or credential revoked
  suspended            → approved             : compliance officer clears suspension
  suspended            → revoked              : compliance officer revokes
  rejected             → under_screening      : admin triggers re-screening (with reason)
  any                  → revoked              : admin override (logged)
```

### E3. Wallet Screening Status

```
States:
  not_screened → pending → complete → review_required
                        → failed (provider error)

Transitions:
  not_screened     → pending          : screening job submitted
  pending          → complete         : result received, risk_level = low/medium (auto-approve path)
  pending          → review_required  : result received, risk_level = medium/high
  pending          → failed           : provider error after max retries
  review_required  → complete         : compliance officer approves
  review_required  → failed           : compliance officer rejects
  failed           → pending          : admin re-triggers screening
  complete         → pending          : admin triggers re-screening
```

### E4. Wallet Credential Status

```
States:
  not_issued → active → suspended → revoked → expired

Transitions:
  not_issued → active    : wallet approved, all conditions met
  active     → suspended : risk signal, compliance hold
  active     → revoked   : admin revoke, KYC expired, sanctions match
  active     → expired   : credential validity period elapsed
  suspended  → active    : compliance officer clears hold
  suspended  → revoked   : compliance officer revokes
  expired    → active    : re-screening passed + renewal approved
  revoked    → [end]     : terminal state — new wallet must be registered
```

### E5. Trading Eligibility Status

```
States:
  locked → pending_kyc → pending_wallet → pending_wallet_screening
        → pending_manual_review → eligible → suspended → blocked

Transitions:
  locked                   → pending_kyc              : account created
  pending_kyc              → pending_wallet            : KYC approved
  pending_kyc              → blocked                   : KYC rejected (max retries)
  pending_wallet           → pending_wallet_screening  : wallet registered + ownership verified
  pending_wallet_screening → eligible                  : wallet approved, credential issued
  pending_wallet_screening → pending_manual_review     : screening flagged for review
  pending_manual_review    → eligible                  : compliance officer approves
  pending_manual_review    → blocked                   : compliance officer rejects
  eligible                 → suspended                 : credential suspended
  eligible                 → blocked                   : credential revoked
  suspended                → eligible                  : suspension cleared
  suspended                → blocked                   : suspension escalated to revocation
  blocked                  → pending_kyc               : admin resets (extreme case, logged)

Note: trading_eligibility is DERIVED — it is NOT stored as a mutable field.
It is computed on every check from: kyc_status + wallet_status + credential_status.
```

---

## F. Database Schema

### F1. `users`
**Purpose**: Core identity record — thin wrapper around Supabase Auth

```sql
CREATE TABLE users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id),
  email           text NOT NULL UNIQUE,
  account_status  text NOT NULL DEFAULT 'active'
                    CHECK (account_status IN ('active','suspended','banned')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(account_status);

-- RLS: users can read their own row; service role only for writes
```

---

### F2. `profiles`
**Purpose**: Extended user data — PII that goes beyond auth identity

```sql
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES users(id),
  first_name      text,
  last_name       text,
  date_of_birth   date,
  nationality     text,           -- ISO 3166-1 alpha-2
  phone           text,
  avatar_url      text,
  source_of_funds text,           -- declaration
  tax_id_hash     text,           -- SHA-256 of tax ID — never store raw
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Security: tax_id_hash is a one-way hash only. Raw tax ID stored at KYC provider.
-- RLS: user owns their row
```

---

### F3. `kyc_cases`
**Purpose**: One KYC case per user per submission attempt

```sql
CREATE TABLE kyc_cases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  status              text NOT NULL DEFAULT 'not_started'
                        CHECK (status IN (
                          'not_started','in_progress','submitted',
                          'under_review','approved','rejected',
                          'retry_required','expired','blocked'
                        )),
  provider            text,                -- 'persona' | 'jumio' | 'onfido' | 'manual'
  provider_case_id    text UNIQUE,         -- external reference
  provider_result     text,                -- raw normalized: 'clear' | 'consider' | 'rejected'
  provider_risk_score numeric(5,2),
  retry_count         integer NOT NULL DEFAULT 0,
  max_retries         integer NOT NULL DEFAULT 3,
  submitted_at        timestamptz,
  reviewed_at         timestamptz,
  approved_at         timestamptz,
  expires_at          timestamptz,         -- KYC validity end date
  rejection_reason    text,                -- mapped, safe to show user
  internal_notes      text,               -- compliance staff only
  admin_override_by   uuid REFERENCES users(id),
  admin_override_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Only one active case per user
CREATE UNIQUE INDEX idx_kyc_cases_active_user
  ON kyc_cases(user_id)
  WHERE status NOT IN ('rejected', 'expired', 'blocked');

-- Indexes
CREATE INDEX idx_kyc_cases_user_id ON kyc_cases(user_id);
CREATE INDEX idx_kyc_cases_status ON kyc_cases(status);
CREATE INDEX idx_kyc_cases_provider_case_id ON kyc_cases(provider_case_id);
```

---

### F4. `kyc_documents`
**Purpose**: Track each uploaded document within a KYC case

```sql
CREATE TABLE kyc_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id     uuid NOT NULL REFERENCES kyc_cases(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  document_type   text NOT NULL
                    CHECK (document_type IN (
                      'id_front','id_back','selfie','liveness_video',
                      'proof_of_address','tax_document','other'
                    )),
  storage_path    text NOT NULL,    -- encrypted storage path (NOT a public URL)
  storage_bucket  text NOT NULL,    -- e.g. 'kyc-documents' (private, no public access)
  file_hash       text NOT NULL,    -- SHA-256 of file contents for integrity
  file_size_bytes integer,
  mime_type       text,
  upload_status   text NOT NULL DEFAULT 'pending'
                    CHECK (upload_status IN ('pending','complete','failed')),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz      -- pre-signed URL expiry (never stored here)
);

-- Indexes
CREATE INDEX idx_kyc_documents_case ON kyc_documents(kyc_case_id);
CREATE INDEX idx_kyc_documents_user ON kyc_documents(user_id);

-- Security:
-- storage_path is encrypted at rest
-- Storage bucket has NO public access — files accessed only via service role
-- Pre-signed URLs generated per-request with short TTL (15 min max)
-- Documents NEVER stored in the application database as binary
```

---

### F5. `kyc_status_history`
**Purpose**: Immutable record of every KYC status transition

```sql
CREATE TABLE kyc_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id     uuid NOT NULL REFERENCES kyc_cases(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  from_status     text,
  to_status       text NOT NULL,
  actor_type      text NOT NULL CHECK (actor_type IN ('system','user','admin','provider')),
  actor_id        uuid,
  reason          text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Append only — no UPDATE or DELETE allowed
-- Enforced via RLS: INSERT only for service role, SELECT for owner + compliance roles
CREATE INDEX idx_kyc_history_case ON kyc_status_history(kyc_case_id);
```

---

### F6. `wallets`
**Purpose**: Wallets registered by users — one record per wallet address per user

```sql
CREATE TABLE wallets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  wallet_address      text NOT NULL,           -- XRPL r-address
  network             text NOT NULL DEFAULT 'mainnet'
                        CHECK (network IN ('mainnet','testnet')),
  provider            text NOT NULL DEFAULT 'xaman'
                        CHECK (provider IN ('xaman','manual','hardware')),
  label               text,
  status              text NOT NULL DEFAULT 'pending_verification'
                        CHECK (status IN (
                          'pending_verification','verified','under_screening',
                          'approved','rejected','suspended','revoked'
                        )),
  ownership_verified  boolean NOT NULL DEFAULT false,
  ownership_verified_at timestamptz,
  approved_at         timestamptz,
  revoked_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (wallet_address, network)  -- same address cannot be registered by two users
);

-- Indexes
CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_address ON wallets(wallet_address);
CREATE INDEX idx_wallets_status ON wallets(status);

-- The UNIQUE constraint on (wallet_address, network) enforces RULE-012
```

---

### F7. `wallet_verification_events`
**Purpose**: Record each ownership verification attempt

```sql
CREATE TABLE wallet_verification_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id         uuid NOT NULL REFERENCES wallets(id),
  user_id           uuid NOT NULL REFERENCES users(id),
  method            text NOT NULL CHECK (method IN ('xaman_sign','manual','hardware')),
  xaman_payload_uuid text,
  signed_address    text,                  -- address returned from Xaman — must match wallet_address
  address_match     boolean,
  status            text NOT NULL
                      CHECK (status IN ('pending','verified','failed','expired')),
  failure_reason    text,
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_verify_wallet ON wallet_verification_events(wallet_id);
```

---

### F8. `wallet_screening_results`
**Purpose**: Record the result of each screening attempt for a wallet

```sql
CREATE TABLE wallet_screening_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id             uuid NOT NULL REFERENCES wallets(id),
  user_id               uuid NOT NULL REFERENCES users(id),
  provider              text NOT NULL,           -- 'elliptic' | 'chainalysis' | 'trm' | 'internal'
  provider_ref          text,                    -- provider's reference ID
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','complete','review_required','failed')),
  risk_level            text
                          CHECK (risk_level IN ('low','medium','high','severe')),
  risk_score            numeric(5,2),            -- 0–100
  sanctions_exposure    boolean DEFAULT false,
  cluster_risk          boolean DEFAULT false,
  flags                 jsonb DEFAULT '[]',      -- array of WalletRiskFlag objects
  raw_response_hash     text,                    -- SHA-256 of raw provider response
  screened_at           timestamptz,
  review_required_reason text,
  reviewed_by           uuid REFERENCES users(id),
  reviewed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_screening_wallet ON wallet_screening_results(wallet_id);
CREATE INDEX idx_screening_status ON wallet_screening_results(status);
```

---

### F9. `wallet_risk_flags`
**Purpose**: Individual risk signals associated with a wallet (one per flag)

```sql
CREATE TABLE wallet_risk_flags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       uuid NOT NULL REFERENCES wallets(id),
  screening_id    uuid REFERENCES wallet_screening_results(id),
  flag_type       text NOT NULL,    -- 'sanctions', 'mixer', 'darknet', 'high_risk_exchange', etc.
  severity        text NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  description     text,
  source          text,             -- 'provider_name' | 'internal_rule'
  detected_at     timestamptz NOT NULL DEFAULT now(),
  resolved        boolean DEFAULT false,
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES users(id),
  resolution_note text
);

CREATE INDEX idx_risk_flags_wallet ON wallet_risk_flags(wallet_id);
CREATE INDEX idx_risk_flags_severity ON wallet_risk_flags(severity);
```

---

### F10. `wallet_credentials`
**Purpose**: The authorization credential issued to an approved wallet

```sql
CREATE TABLE wallet_credentials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id         uuid NOT NULL REFERENCES wallets(id),
  user_id           uuid NOT NULL REFERENCES users(id),
  kyc_case_id       uuid NOT NULL REFERENCES kyc_cases(id),
  screening_id      uuid NOT NULL REFERENCES wallet_screening_results(id),
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','suspended','revoked','expired')),
  issued_at         timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,               -- NULL = no expiry (until explicitly revoked)
  revoked_at        timestamptz,
  revoked_by        uuid REFERENCES users(id),
  revocation_reason text,
  suspended_at      timestamptz,
  suspended_reason  text,
  credential_hash   text NOT NULL,             -- HMAC of (wallet_id + user_id + issued_at) for integrity
  metadata          jsonb DEFAULT '{}',        -- future: on-chain ref, VC DID, etc.
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One active credential per wallet at a time
CREATE UNIQUE INDEX idx_credential_active_wallet
  ON wallet_credentials(wallet_id)
  WHERE status = 'active';

CREATE INDEX idx_credentials_wallet ON wallet_credentials(wallet_id);
CREATE INDEX idx_credentials_user ON wallet_credentials(user_id);
CREATE INDEX idx_credentials_status ON wallet_credentials(status);
```

---

### F11. `trading_permissions` (Derived Cache — Optional)
**Purpose**: Materialized view of trading eligibility. NOT the source of truth — recomputed from credential + KYC states. Used as a fast cache for the eligibility engine.

```sql
CREATE TABLE trading_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  wallet_id       uuid NOT NULL REFERENCES wallets(id),
  eligible        boolean NOT NULL DEFAULT false,
  eligibility_code text NOT NULL,   -- reason code: 'pending_kyc', 'eligible', etc.
  last_evaluated  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, wallet_id)
);

-- NOTE: This is a performance cache. Source of truth is always:
--   kyc_cases.status + wallets.status + wallet_credentials.status
-- Recomputed on every state change via domain event handler.
-- Never trust this table alone — always verify from source tables on sensitive operations.
```

---

### F12. `compliance_reviews`
**Purpose**: Manual review records for cases requiring human decision

```sql
CREATE TABLE compliance_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type    text NOT NULL CHECK (subject_type IN ('kyc_case','wallet','credential')),
  subject_id      uuid NOT NULL,
  user_id         uuid NOT NULL REFERENCES users(id),
  assigned_to     uuid REFERENCES users(id),   -- compliance officer
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','approved','rejected','escalated')),
  priority        text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  reason          text,
  decision        text,
  decision_notes  text,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  due_at          timestamptz
);

CREATE INDEX idx_compliance_reviews_status ON compliance_reviews(status);
CREATE INDEX idx_compliance_reviews_subject ON compliance_reviews(subject_type, subject_id);
```

---

### F13. `audit_logs`
**Purpose**: Immutable audit trail for all compliance domain events

```sql
CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text NOT NULL,          -- e.g. 'kyc.approved', 'wallet.credential_issued'
  domain          text NOT NULL,          -- 'kyc' | 'wallet' | 'credential' | 'trading'
  actor_type      text NOT NULL CHECK (actor_type IN ('user','admin','system','provider')),
  actor_id        text,                   -- UUID or provider name
  subject_type    text,                   -- 'kyc_case' | 'wallet' | 'credential' etc.
  subject_id      uuid,
  user_id         uuid REFERENCES users(id),
  old_state       text,
  new_state       text,
  ip_address      text,
  user_agent      text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- APPEND ONLY — enforced via RLS (INSERT only, no UPDATE/DELETE for any role)
-- Partitioned by month for scalability (future)
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_subject ON audit_logs(subject_type, subject_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

---

### F14. `admin_actions`
**Purpose**: Record every manual action taken by compliance staff

```sql
CREATE TABLE admin_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES users(id),
  action_type     text NOT NULL,     -- 'approve_kyc', 'reject_wallet', 'override_eligibility', etc.
  target_type     text NOT NULL,
  target_id       uuid NOT NULL,
  user_id         uuid REFERENCES users(id),
  reason          text NOT NULL,     -- required for all admin actions
  previous_state  text,
  new_state       text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_type, target_id);
```

---

### F15. `notifications`

```sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  type            text NOT NULL,     -- 'kyc_approved', 'wallet_approved', 'trading_enabled', etc.
  channel         text NOT NULL CHECK (channel IN ('email','in_app','sms')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','failed','read')),
  subject         text,
  body            text,
  metadata        jsonb DEFAULT '{}',
  sent_at         timestamptz,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, status);
```

---

## G. Backend / API Design

All endpoints are Supabase Edge Functions (Deno) or Next.js API routes. Auth enforcement via JWT middleware on every request.

---

### G1. `POST /kyc/create-case`

**Purpose**: Initialize a KYC case for the authenticated user

**Auth**: Supabase Auth JWT required

**Guards**: No existing active case for this user

**Request**: `{}`

**Response**:
```json
{ "kyc_case_id": "uuid", "status": "in_progress" }
```

**Errors**: 409 if active case exists, 401 if not authenticated

---

### G2. `POST /kyc/upload-document`

**Purpose**: Upload a KYC document to encrypted private storage

**Auth**: JWT required. `user_id` from token, NOT from body.

**Request**: `multipart/form-data` — `kyc_case_id`, `document_type`, `file`

**Validation**:
- `document_type` in allowed list
- MIME type: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Max file size: 10MB
- Case must be owned by authenticated user
- Case status must be `in_progress`

**Process**:
1. Generate `UUID.ext` filename
2. Compute SHA-256 of file
3. Upload to private `kyc-documents` bucket (server-side encrypted)
4. Insert `kyc_documents` record with `storage_path` (NOT a public URL)
5. Return document ID

**Response**: `{ "document_id": "uuid", "document_type": "id_front", "upload_status": "complete" }`

**Security**:
- File never touches application memory as a buffer for more than upload duration
- Storage path is encrypted in DB
- No public URL ever generated

---

### G3. `POST /kyc/submit`

**Purpose**: Finalize and submit the KYC case for review

**Auth**: JWT required

**Guards**:
- Case must be `in_progress`
- Required documents must all be uploaded (id_front, id_back, selfie minimum)
- Required profile fields must be populated (name, DOB, address, nationality)

**Process**:
1. Validate completeness
2. Set `kyc_cases.status = 'submitted'`
3. Create `kyc_status_history` record
4. Invoke `KYCProviderIntegrationModule` (async — do not block response)
5. Emit `kyc.submitted` domain event
6. Create notification (pending)

**Response**: `{ "kyc_case_id": "uuid", "status": "submitted" }`

---

### G4. `GET /kyc/status`

**Purpose**: Fetch current KYC status for the authenticated user

**Auth**: JWT required

**Response**:
```json
{
  "kyc_case_id": "uuid",
  "status": "approved",
  "submitted_at": "ISO",
  "approved_at": "ISO",
  "expires_at": "ISO",
  "retry_count": 0,
  "rejection_reason": null
}
```

---

### G5. `POST /kyc/provider-webhook`

**Purpose**: Receive async decision from KYC provider

**Auth**: Webhook signature verification (provider-specific HMAC or signed JWT)

**Process**:
1. Verify signature
2. Parse normalized result
3. Map to internal status via Decision Engine
4. Update `kyc_cases` + `kyc_status_history`
5. Emit `kyc.approved` / `kyc.rejected` / `kyc.review_required`
6. Trigger notification
7. Respond 200 immediately (idempotent — check `provider_case_id` uniqueness)

**Idempotency**: If same `provider_case_id` received twice, ignore second.

---

### G6. `POST /wallets/register`

**Purpose**: Register a new wallet address

**Auth**: JWT required

**Guards**:
- KYC status must be `approved`
- Wallet address not already registered (UNIQUE constraint)
- Valid XRPL address format

**Request**: `{ "wallet_address": "rXXX...", "network": "mainnet", "provider": "xaman", "label": "Primary" }`

**Response**: `{ "wallet_id": "uuid", "status": "pending_verification" }`

---

### G7. `POST /wallets/initiate-verification`

**Purpose**: Create Xaman signing payload for wallet ownership proof

**Auth**: JWT required

**Guards**: Wallet must be `pending_verification` and owned by user

**Process**:
1. Call `xaman-create-payload` (existing function)
2. Insert `wallet_verification_events` record (`status = 'pending'`)
3. Return QR code data

**Response**: `{ "verification_event_id": "uuid", "qr_code": "url", "uuid": "xaman_uuid", "expires_at": "ISO" }`

---

### G8. `POST /wallets/confirm-verification`

**Purpose**: Confirm wallet ownership after Xaman signing

**Auth**: JWT required

**Process**:
1. Call `xaman-check-payload` with UUID
2. If `signed = true`:
   - Verify `response.account === wallet.wallet_address`
   - Update `wallet_verification_events.status = 'verified'`
   - Update `wallets.status = 'verified'`, `ownership_verified = true`
   - Trigger screening automatically
3. If mismatch: fail, log fraud signal to `wallet_risk_flags`

**Response**: `{ "verified": true, "screening_triggered": true }` or `{ "verified": false, "reason": "address_mismatch" }`

---

### G9. `POST /wallets/trigger-screening`

**Purpose**: (Re-)trigger AML screening for a verified wallet

**Auth**: JWT (user for initial) or admin role (for re-screening)

**Guards**: Wallet must be `verified` or `approved` (re-screen)

**Process**:
1. Fetch wallet transaction history snapshot from XRPL
2. Submit to screening provider
3. Create `wallet_screening_results` record (`status = 'pending'`)
4. Update `wallets.status = 'under_screening'`
5. Return screening result ID

**Response**: `{ "screening_id": "uuid", "status": "pending" }`

---

### G10. `GET /wallets/screening-status/:wallet_id`

**Purpose**: Fetch current screening result

**Auth**: JWT required (own wallet) or admin

**Response**:
```json
{
  "screening_id": "uuid",
  "status": "complete",
  "risk_level": "low",
  "risk_score": 12.5,
  "sanctions_exposure": false,
  "flags": []
}
```

---

### G11. `POST /wallets/issue-credential`

**Purpose**: Issue trading credential to an approved wallet (system-triggered, not user-callable)

**Auth**: Service role only (called internally by screening completion handler)

**Guards**:
- `wallet.status = 'approved'`
- `kyc_cases.status = 'approved'`
- No active credential exists for this wallet

**Process**:
1. Generate `credential_hash` (HMAC of wallet_id + user_id + issued_at)
2. Insert `wallet_credentials` record
3. Update `trading_permissions` cache
4. Emit `credential.issued` event
5. Trigger "trading enabled" notification

---

### G12. `POST /wallets/revoke-credential`

**Purpose**: Revoke an active credential

**Auth**: Admin role (compliance_officer or super_admin)

**Request**: `{ "credential_id": "uuid", "reason": "string" }`

**Process**:
1. Set `wallet_credentials.status = 'revoked'`
2. Update `wallets.status = 'revoked'`
3. Invalidate `trading_permissions` cache
4. Log to `admin_actions` + `audit_logs`
5. Emit `credential.revoked` event
6. Notify user

---

### G13. `GET /trading/eligibility`

**Purpose**: Evaluate and return current trading eligibility for authenticated user + wallet

**Auth**: JWT required

**Query Params**: `?wallet_id=uuid`

**Process (always computed from source, never from cache alone)**:
1. Fetch `kyc_cases` current status for user
2. Fetch `wallets` status for requested wallet
3. Fetch `wallet_credentials` active status
4. Run eligibility decision logic (see Section K)
5. Return result

**Response**:
```json
{
  "eligible": false,
  "eligibility_code": "pending_wallet_screening",
  "locked_gates": ["wallet_not_screened"],
  "kyc_status": "approved",
  "wallet_status": "under_screening",
  "credential_status": "not_issued"
}
```

---

### G14. `POST /admin/kyc/review`

**Auth**: Admin role required (`compliance_officer` or above)

**Request**: `{ "kyc_case_id": "uuid", "decision": "approved" | "rejected" | "retry_required", "reason": "string", "notes": "string" }`

**Process**: Updates case, creates history record, creates admin_action, emits event

---

### G15. `POST /admin/wallets/review`

**Auth**: Admin role

**Request**: `{ "wallet_id": "uuid", "decision": "approved" | "rejected", "reason": "string" }`

---

### G16. Screening Provider Webhook

**Auth**: Provider-specific signature verification

**Process**: Normalize result → update `wallet_screening_results` → trigger credential issuance or flag for review

---

## H. Frontend Requirements

### H1. KYC Gate (Dashboard Banner / Full-Screen Gate)

**Shows when**: KYC status ≠ 'approved'

**Elements**:
- Status indicator (icon + label): "Identity verification required"
- Progress bar showing pipeline: Account → KYC → Wallet → Trading
- CTA button: "Start Verification" → `/kyc/start`
- Status-specific messaging:
  - `not_started`: "Complete identity verification to begin trading"
  - `in_progress`: "Finish your verification — you have a draft in progress"
  - `submitted`: "Your application is under review (typically 1–3 business days)"
  - `under_review`: "We're reviewing your application — no action needed"
  - `retry_required`: "Action required: [specific document issue]"
  - `rejected`: "Verification failed — [safe reason]. [Retry if allowed]"

---

### H2. KYC Submission Flow (Multi-Step)

**Step 1 — Personal Information**:
- Fields: Legal First Name, Legal Last Name, Date of Birth, Nationality (dropdown), Country of Residence
- Validations: All required, DOB must be 18+ years ago, name max 100 chars
- Auto-save as draft on each field blur

**Step 2 — Address**:
- Fields: Street Address, City, State/Province, ZIP/Postal Code, Country
- Integration: Google Places autocomplete (existing `places-autocomplete` function)

**Step 3 — Document Upload**:
- Sub-steps: ID Front, ID Back, Selfie
- For each: drag-and-drop or file picker, image preview, file validation (type, size), upload progress bar
- Retry on failure
- Required indicator per document type

**Step 4 — Review + Submit**:
- Summary of entered data (NOT documents — no re-display of sensitive images)
- Consent checkbox: "I certify that the information provided is accurate"
- Submit button — disabled until all required fields and documents present
- Loading state during submission

**States**: draft (auto-saved) | submitting | submitted (redirect to status page)

---

### H3. KYC Status Page

**Shows after submission**:
- Current status with icon (pending / in_review / approved / rejected)
- Estimated timeline
- "What happens next" explainer
- Contact support link
- For `retry_required`: specific document re-upload interface

---

### H4. Wallet Registration Page

**Shows when**: KYC = 'approved' AND no wallets registered (or "Add Wallet" flow)

**Step 1 — Enter Address**:
- Input: XRPL wallet address (r-address)
- Validation: XRPL address regex
- Network selector: Mainnet / Testnet
- Label input (optional)

**Step 2 — Prove Ownership**:
- Xaman QR code displayed
- "Waiting for signature..." spinner
- Instructions: "Open Xaman → scan → sign"
- Timeout indicator (5 min)
- Cancel option

**Step 3 — Screening In Progress**:
- "Your wallet is being reviewed" state
- Estimated timeframe
- No action required from user

**Step 4 — Approved / Rejected**:
- Approved: green confirmation, CTA to start trading
- Rejected: reason (safe, mapped), contact support option
- Flagged for review: "Under manual review" state with timeline

---

### H5. Trading Locked Page / Component

**Shows on any trading-adjacent page when eligibility ≠ 'eligible'**:
- Clear message: "Trading is not yet available"
- Pipeline status checklist:
  - ✅ Account created
  - ✅ / ⏳ / ❌ Identity verified
  - ✅ / ⏳ / ❌ Wallet registered
  - ✅ / ⏳ / ❌ Wallet approved
- Next action CTA based on locked_gates
- Never shows generic error — always actionable

---

### H6. Admin Compliance Dashboard

**Access**: `compliance_reviewer`, `compliance_officer`, `super_admin` roles only

**Sections**:
1. **KYC Queue** — table of cases in `submitted` / `under_review` / `retry_required`
   - Columns: User, Submitted At, Provider Result, Risk Score, Actions
   - Actions: View Documents (secure viewer), Approve, Reject, Request More Info, Escalate

2. **Wallet Review Queue** — flagged wallets needing manual review
   - Columns: Wallet Address, User, Risk Level, Flags, Screening Provider, Actions
   - Actions: Approve, Reject, Re-screen, View History

3. **Active Credentials** — all issued credentials with status
   - Actions: Suspend, Revoke

4. **Audit Log Viewer** — searchable, filterable by event type, user, date range

5. **Admin Action History** — every action taken by staff, with reasons

---

## I. Wallet Screening Architecture Options

### Option A: Third-Party Provider Integration

**Recommended providers for XRPL**: Elliptic, TRM Labs (both support XRPL natively)

**Integration Architecture**:

```typescript
// Provider Adapter Interface — swap providers without changing upstream code
interface ScreeningProviderAdapter {
  submitWallet(address: string, network: string, history?: TxSnapshot): Promise<ScreeningJob>;
  getResult(jobId: string): Promise<NormalizedScreeningResult>;
  supportsWebhook: boolean;
}

// Concrete implementation per provider
class EllipticAdapter implements ScreeningProviderAdapter { ... }
class TRMLabsAdapter implements ScreeningProviderAdapter { ... }
class InternalAdapter implements ScreeningProviderAdapter { ... }
```

**Data sent to provider**: wallet address, blockchain identifier (`xrpl`), optional transaction history snapshot

**Webhook receiver**:
1. Verify provider signature (HMAC or asymmetric)
2. Parse raw response
3. Map to `NormalizedScreeningResult`
4. Store raw response hash (SHA-256) — never raw PII
5. Update `wallet_screening_results`
6. Trigger downstream logic

**Normalization**: All provider responses MUST be mapped to the common schema before storage. Raw provider responses are NEVER stored in the DB — only the hash for audit purposes.

**Vendor lock-in prevention**:
- All provider calls go through the adapter interface
- Normalized schema is provider-agnostic
- Switching providers requires: new adapter class + update `provider` field in config
- No provider-specific fields leak into application business logic

**Build Now**:
- Adapter interface + one concrete provider (TRM Labs or Elliptic)
- Webhook receiver with signature verification
- Normalization schema
- Retry queue for provider failures

---

### Option B: Internal Wallet Risk Engine

**When to build**: Phase 5–6, after third-party integration is stable

**Architecture**:

```
WalletRiskEngine
├── DataCollector    — fetch on-chain history via xrpl-account-data
├── RuleEngine       — deterministic flag rules
├── ScoringEngine    — weighted risk score aggregation
├── GraphAnalyzer    — related address detection (future)
└── BehaviorMonitor  — ongoing post-approval monitoring (future)
```

**Phase 1 — Basic Heuristics (Build Now)**:
- Wallet age (< 30 days = higher risk)
- Number of unique counterparties
- Total transaction volume
- Large single transactions
- Frequency anomalies

**Phase 2 — Sanctions Matching (Build Later)**:
- Local OFAC SDN list mirror (updated daily)
- EU consolidated sanctions list
- Fuzzy address matching

**Phase 3 — Graph Analysis (Future)**:
- First-degree wallet relationships (who sent to this wallet directly)
- Detection of mixer/tumbler patterns
- Cluster analysis for related wallets

**Phase 4 — Behavioral Monitoring (Future)**:
- Continuous post-approval monitoring via XRPL WebSocket subscription
- Alert on sudden volume spikes, new counterparty types, suspicious patterns
- Trigger re-screening automatically

**Risk Score Calculation**:
```typescript
type RuleResult = { flag_type: string; weight: number; triggered: boolean };

function calculateRiskScore(rules: RuleResult[]): number {
  const totalWeight = rules.reduce((sum, r) => sum + r.weight, 0);
  const triggeredWeight = rules.filter(r => r.triggered).reduce((sum, r) => sum + r.weight, 0);
  return Math.min(100, Math.round((triggeredWeight / totalWeight) * 100));
}
```

**Build Now from Option B**: Schema only + DataCollector stub
**Build Later**: RuleEngine, ScoringEngine, GraphAnalyzer, BehaviorMonitor

---

## J. Credentialing Model

### Current: DB-Backed Off-Chain Credential

The credential is a row in `wallet_credentials`. It is the single source of authority the eligibility engine checks.

**Credential fields**:
```typescript
interface WalletCredential {
  id: string;                    // Platform credential ID
  wallet_id: string;             // Linked wallet
  user_id: string;               // Linked user
  kyc_case_id: string;           // KYC that authorized this
  screening_id: string;          // Screening that passed
  status: 'active' | 'suspended' | 'revoked' | 'expired';
  issued_at: string;
  expires_at: string | null;     // null = no expiry until revocation
  credential_hash: string;       // HMAC(wallet_id + user_id + issued_at, platform_secret)
  metadata: {
    risk_level: string;          // from screening
    kyc_provider: string;
    screening_provider: string;
    issuer_id: string;           // platform identifier
    // future: vc_did, on_chain_ref
  };
}
```

**Issuance Trigger**:
- `wallet.status → 'approved'` AND `kyc_cases.status = 'approved'`
- Called by system automatically — never by user request

**Revocation Rules**:
- KYC expires → credential status → 'expired'
- Admin manual revoke → 'revoked'
- Wallet flagged post-approval → 'suspended' (pending review), then 'revoked' if confirmed
- User requests data deletion → 'revoked'

**Validity Period**: Default — no expiry. Future: 12-month KYC-linked expiry.

---

### Future: On-Chain Verifiable Credential (W3C VC)

**When to build**: V3, after XRPL supports DID anchoring

**Design**:
- Platform acts as the credential issuer (DID: `did:xrpl:platform_address`)
- User's wallet is the credential subject (DID: `did:xrpl:wallet_address`)
- Credential contains: KYC approval proof, screening clearance, issuance date, expiry
- Stored on XRPL as an NFT payload or in an account's domain field
- Verifiable by any permissioned DEX or token issuer without calling our API
- Revocation: update NFT or emit on-chain revocation event

**This makes the credential trustless** — an issuer can verify trading eligibility without API access.

---

## K. Trading Eligibility Engine

### Decision Logic (Pseudocode)

```typescript
async function evaluateTradingEligibility(
  userId: string,
  walletId: string
): Promise<EligibilityResult> {

  // Fetch current states from source tables
  const kyc = await getActiveKycCase(userId);
  const wallet = await getWallet(walletId, userId);
  const credential = await getActiveCredential(walletId);

  // Gate 1: Account status
  const user = await getUser(userId);
  if (user.account_status === 'banned') {
    return deny('account_banned', ['account_banned']);
  }
  if (user.account_status === 'suspended') {
    return deny('account_suspended', ['account_suspended']);
  }

  // Gate 2: KYC
  if (!kyc || kyc.status === 'not_started') {
    return deny('pending_kyc', ['kyc_not_started']);
  }
  if (['in_progress', 'submitted', 'under_review', 'retry_required'].includes(kyc.status)) {
    return deny('pending_kyc', ['kyc_in_progress']);
  }
  if (['rejected', 'blocked'].includes(kyc.status)) {
    return deny('blocked', ['kyc_rejected']);
  }
  if (kyc.status === 'expired') {
    return deny('pending_kyc', ['kyc_expired']);
  }
  // kyc.status must be 'approved' to proceed

  // Gate 3: Wallet existence
  if (!wallet) {
    return deny('pending_wallet', ['no_wallet_registered']);
  }
  if (wallet.user_id !== userId) {
    return deny('blocked', ['wallet_not_owned']);
  }

  // Gate 4: Wallet ownership
  if (!wallet.ownership_verified) {
    return deny('pending_wallet', ['wallet_not_verified']);
  }

  // Gate 5: Wallet status
  if (wallet.status === 'pending_verification') {
    return deny('pending_wallet', ['wallet_pending_verification']);
  }
  if (wallet.status === 'under_screening') {
    return deny('pending_wallet_screening', ['wallet_screening_in_progress']);
  }
  if (wallet.status === 'rejected') {
    return deny('blocked', ['wallet_rejected']);
  }
  if (wallet.status === 'revoked') {
    return deny('blocked', ['wallet_revoked']);
  }
  if (wallet.status === 'suspended') {
    return deny('suspended', ['wallet_suspended']);
  }

  // Gate 6: Credential
  if (!credential) {
    return deny('pending_wallet_screening', ['credential_not_issued']);
  }
  if (credential.status === 'suspended') {
    return deny('suspended', ['credential_suspended']);
  }
  if (credential.status === 'revoked') {
    return deny('blocked', ['credential_revoked']);
  }
  if (credential.status === 'expired') {
    return deny('pending_kyc', ['credential_expired']);
  }

  // All gates passed
  return allow('eligible');
}
```

### Decision Table

| KYC Status | Wallet Status | Credential Status | Result |
|---|---|---|---|
| not_started | any | any | `pending_kyc` |
| in_progress | any | any | `pending_kyc` |
| submitted | any | any | `pending_kyc` |
| under_review | any | any | `pending_kyc` |
| rejected | any | any | `blocked` |
| approved | unregistered | any | `pending_wallet` |
| approved | pending_verification | any | `pending_wallet` |
| approved | verified | any | `pending_wallet_screening` |
| approved | under_screening | any | `pending_wallet_screening` |
| approved | rejected | any | `blocked` |
| approved | suspended | any | `suspended` |
| approved | revoked | any | `blocked` |
| approved | approved | not_issued | `pending_wallet_screening` |
| approved | approved | suspended | `suspended` |
| approved | approved | revoked | `blocked` |
| approved | approved | expired | `pending_kyc` |
| approved | approved | active | **`eligible`** |

**Enforcement Points**:
1. Every trading API endpoint calls `evaluateTradingEligibility()` — hard gate
2. Permissioned DEX hooks call credential verification endpoint
3. Token issuance/transfer edge functions check eligibility before building transactions
4. Frontend gate component checks eligibility on page load — but this is UI only, not enforcement

---

## L. Admin + Compliance Operations

### L1. Roles

| Role | Permissions |
|---|---|
| `compliance_reviewer` | View KYC cases, documents, screening results, audit logs |
| `compliance_officer` | All reviewer + approve/reject KYC, approve/reject wallets, suspend credentials |
| `super_admin` | All officer + revoke credentials, override any status, view raw provider responses |

### L2. KYC Review Workflow

1. Case appears in review queue (status = `under_review` or `retry_required`)
2. Officer opens case → views personal information, document previews (secure viewer only)
3. Document viewer: generates time-limited pre-signed URL (15 min TTL), logs access to audit_log
4. Officer decision:
   - **Approve**: KYC → `approved`, domain event emitted
   - **Reject**: KYC → `rejected`, reason required, user notified
   - **Request more info**: KYC → `retry_required`, specific document type flagged
   - **Escalate**: Compliance review record created for senior review

### L3. Wallet Review Workflow

1. Wallet appears in review queue (screening_status = `review_required`)
2. Officer views: wallet address, network, XRPL transaction history (fetched live), screening flags, risk score
3. Officer decision:
   - **Approve**: wallet → `approved`, credential issued
   - **Reject**: wallet → `rejected`, user notified
   - **Re-screen**: trigger new screening job
   - **Flag**: add manual risk flag with severity and type

### L4. Credential Operations

| Action | Who | Trigger | Effect |
|---|---|---|---|
| Issue | System | Wallet approved + KYC approved | `credential.status = 'active'` |
| Suspend | Compliance Officer | Risk signal, hold | `credential.status = 'suspended'` |
| Revoke | Compliance Officer | Policy violation | `credential.status = 'revoked'` |
| Re-evaluate | Compliance Officer | After remediation | If cleared → `'active'` |

### L5. Re-Screening

- Manual: Admin triggers from wallet detail page (requires reason)
- Automated: Scheduled job (monthly for all active wallets — future)
- Event-driven: Automated risk signal triggers re-screen

---

## M. Security + Compliance Controls

### M1. Document Security

- KYC documents stored in **private, access-controlled storage bucket** — no public URLs ever
- Files encrypted at rest (AES-256, server-side)
- File content hash (SHA-256) stored in DB for integrity verification
- Pre-signed URLs generated per-access with 15-minute TTL
- Every document access logged to `audit_logs`
- Retention: 7 years minimum (regulatory requirement)
- Deletion: only via compliance officer with documented reason

### M2. PII Protection

- Raw tax ID never stored in application DB — hash only
- Profile PII stored separately from auth identity
- KYC documents never in application DB — only storage path (encrypted)
- No PII in log messages or error responses
- All API responses strip sensitive fields via response transformers

### M3. Secret Management

- Provider API keys in secrets manager (Supabase Vault / AWS Secrets Manager) — never in environment variables committed to source
- Webhook signature secrets rotated quarterly
- `credential_hash` HMAC key stored in secrets manager, not in DB

### M4. Role-Based Access

- Roles enforced at DB level via Supabase RLS policies
- Roles enforced at API level via middleware — not just RLS
- Never trust role claims from client JWT without server-side verification
- Compliance reviewer cannot approve — only recommend (enforced at DB + API)

### M5. Server-Side Eligibility Enforcement

- `evaluateTradingEligibility()` is called on the server on every protected request
- Never cache eligibility decision on the client
- Frontend gates are UX only — the server never trusts them
- Eligibility computed from source tables — not from `trading_permissions` cache alone on sensitive operations

### M6. Audit Trail

- All state changes produce `audit_logs` entries (via DB trigger or service-layer)
- `audit_logs` is INSERT-only — no UPDATE/DELETE for any role including `super_admin`
- Log entries include: actor, subject, old_state, new_state, IP, timestamp
- Retained 7+ years

### M7. Anti-Fraud Controls

- Wallet address uniqueness enforced at DB level (one user per address per network)
- Signed address from Xaman must exactly match registered address — no partial match
- Rate limits on: KYC submissions (3/day), wallet registrations (5/day), verification attempts (10/day)
- Admin overrides require documented reason — cannot be silent

### M8. Re-Screening and Credential Revocation

- Credential revocation takes effect **immediately** — no grace period
- Re-screening can be triggered independently of credential status
- Post-approval monitoring (future) can suspend credentials automatically pending review

### M9. Provider Webhook Security

- All incoming webhooks validated via HMAC signature or asymmetric signature
- Webhook processing is idempotent (deduplicated by `provider_ref`)
- Webhooks processed asynchronously — always respond 200 immediately

---

## N. File / Folder Structure

```
src/
├── domains/
│   └── compliance/
│       ├── kyc/
│       │   ├── KycGate.tsx              # Gate component shown until KYC complete
│       │   ├── KycStartPage.tsx         # Entry point
│       │   ├── KycPersonalInfoStep.tsx
│       │   ├── KycAddressStep.tsx
│       │   ├── KycDocumentUploadStep.tsx
│       │   ├── KycReviewStep.tsx
│       │   ├── KycStatusPage.tsx
│       │   └── hooks/
│       │       ├── useKycCase.ts
│       │       ├── useKycSubmit.ts
│       │       └── useDocumentUpload.ts
│       ├── wallet/
│       │   ├── WalletRegistrationPage.tsx
│       │   ├── WalletOwnershipVerify.tsx
│       │   ├── WalletScreeningStatus.tsx
│       │   ├── WalletApprovedBanner.tsx
│       │   └── hooks/
│       │       ├── useWalletRegistration.ts
│       │       ├── useWalletScreening.ts
│       │       └── useWalletCredential.ts
│       ├── eligibility/
│       │   ├── TradingGate.tsx          # Wraps any trading-adjacent component
│       │   ├── EligibilityStatus.tsx
│       │   └── hooks/
│       │       └── useTradingEligibility.ts
│       └── admin/
│           ├── ComplianceDashboard.tsx
│           ├── KycReviewQueue.tsx
│           ├── WalletReviewQueue.tsx
│           ├── CredentialManager.tsx
│           └── AuditLogViewer.tsx

supabase/
├── functions/
│   ├── kyc-create-case/index.ts
│   ├── kyc-upload-document/index.ts
│   ├── kyc-submit/index.ts
│   ├── kyc-status/index.ts
│   ├── kyc-provider-webhook/index.ts
│   ├── wallet-register/index.ts
│   ├── wallet-initiate-verification/index.ts
│   ├── wallet-confirm-verification/index.ts
│   ├── wallet-trigger-screening/index.ts
│   ├── wallet-screening-status/index.ts
│   ├── wallet-issue-credential/index.ts
│   ├── wallet-revoke-credential/index.ts
│   ├── trading-eligibility/index.ts
│   ├── admin-kyc-review/index.ts
│   ├── admin-wallet-review/index.ts
│   └── screening-provider-webhook/index.ts
├── migrations/
│   ├── YYYYMMDD_create_kyc_tables.sql
│   ├── YYYYMMDD_create_wallet_tables.sql
│   ├── YYYYMMDD_create_credential_tables.sql
│   ├── YYYYMMDD_create_audit_log.sql
│   └── YYYYMMDD_create_admin_tables.sql
└── _shared/
    ├── eligibility-engine.ts      # Shared by multiple functions
    ├── audit-logger.ts
    ├── screening-adapter.ts
    └── kyc-decision-engine.ts

docs/
├── KYC_CREDENTIALING_SPEC.md      # This document
├── ARCHITECTURE.md
├── CODE_AUDIT.md
├── AUTH_SYSTEM.md
└── MPT_MINTING.md
```

---

## O. Phased Implementation Plan

### Phase 1 — Account + KYC Gate (Build First)

**Goal**: Users can create accounts and see the KYC requirement gate

**Deliverables**:
- `users` + `profiles` tables
- `KycGate` component shown on dashboard when KYC not approved
- Trading locked state with clear pipeline explainer
- `useAuth` + `useKycCase` hooks

**Acceptance criteria**: Unauthenticated user cannot access any trading surface. Authenticated user without KYC sees gate.

---

### Phase 2 — KYC Submission + Status Tracking

**Goal**: Users can submit KYC — platform tracks status and communicates it

**Deliverables**:
- `kyc_cases`, `kyc_documents`, `kyc_status_history` tables
- KYC intake form (personal info, address, document upload)
- Secure document storage (private bucket, encrypted)
- `kyc-create-case`, `kyc-upload-document`, `kyc-submit` edge functions
- KYC status page + in-progress state
- Manual admin approval (before provider integration)
- `audit_logs` table + logger utility

**Acceptance criteria**: User can submit KYC. Admin can manually approve. KYC status visible. Audit logs written on every state change.

---

### Phase 3 — KYC Provider Integration

**Goal**: Automate KYC decisions via third-party provider

**Deliverables**:
- `ScreeningProviderAdapter` interface
- One concrete provider integration (Persona recommended for start)
- Webhook receiver with signature verification
- `KycDecisionEngine` mapping provider results to platform statuses
- `kyc-provider-webhook` edge function
- Notification emails (KYC approved / rejected)

**Acceptance criteria**: Full KYC automation. Provider webhook → platform status update → user notification. Idempotent webhook handling.

---

### Phase 4 — Wallet Registration + Ownership Verification

**Goal**: KYC-approved users can register and prove wallet ownership

**Deliverables**:
- `wallets`, `wallet_verification_events` tables
- Wallet registration page + Xaman ownership proof flow
- `wallet-register`, `wallet-initiate-verification`, `wallet-confirm-verification` functions
- Address mismatch fraud detection + logging

**Acceptance criteria**: User can register wallet. Ownership verified via Xaman signing. Mismatched address logged as fraud signal.

---

### Phase 5 — Wallet Screening Integration

**Goal**: Verified wallets are screened for AML/risk

**Deliverables**:
- `wallet_screening_results`, `wallet_risk_flags` tables
- `ScreeningProviderAdapter` + first provider (Elliptic or TRM Labs)
- `wallet-trigger-screening` function + webhook handler
- Auto-approve flow for low-risk results
- Manual review queue for medium/high risk
- Admin wallet review interface

**Acceptance criteria**: Wallet screened on registration. Low risk → auto-approved. Medium/high → compliance queue. Screening webhook handled idempotently.

---

### Phase 6 — Credential Issuance + Trading Eligibility Engine

**Goal**: Approved wallets get credentials. Eligibility enforced on every protected request.

**Deliverables**:
- `wallet_credentials`, `trading_permissions` tables
- `wallet-issue-credential` + `wallet-revoke-credential` functions
- `trading-eligibility` function (server-side, called by all trading APIs)
- `TradingGate` component (frontend UX gate — not enforcement)
- Credential revocation flow + user notification
- Full admin compliance dashboard

**Acceptance criteria**: Credential issued automatically on wallet approval. Eligibility returned correctly for every state. Revocation immediately blocks trading. All decisions enforced server-side.

---

### Phase 7 — Re-Screening, Expiry, and Advanced Monitoring

**Goal**: Ongoing compliance maintenance

**Deliverables**:
- Scheduled re-screening job (monthly or configurable)
- KYC expiry tracking + renewal flow
- Credential expiry handling
- Automated risk signal detection (via XRPL subscription monitoring)
- Automated suspension on risk signal
- Internal wallet risk engine (Phase 1 heuristics)
- Compliance review SLA tracking + alerting

---

## P. Risks, Edge Cases, and Future Expansion

### P1. Edge Cases

| Scenario | Handling |
|---|---|
| User passes KYC but adds new wallet | New wallet goes through full screening pipeline. Existing credentials unaffected. |
| Wallet later linked to suspicious behavior | Risk signal → credential suspended → compliance review → approve/revoke |
| KYC expires after trading was active | credential.status → 'expired', trading blocked, user prompted to renew KYC |
| Document upload fails mid-way | Case saved as draft, user can resume. Failed uploads retried up to 3 times. |
| User tries to bypass frontend restrictions | Server enforces eligibility on every API call — frontend bypass has no effect |
| Two users register same wallet address | UNIQUE constraint on `(wallet_address, network)` → 409 error for second user |
| Wallet ownership proof spoofed | Xaman response.account compared to registered address server-side. Server never trusts client claim. |
| Provider webhook arrives out of order | `provider_case_id` / `provider_ref` idempotency check. If state would regress, reject. |
| Screening vendor fails temporarily | Retry queue with exponential backoff. `screening_status = 'provider_error'` until resolved. Admin alerted. |
| Admin overrides a blocked wallet | Allowed for `compliance_officer`+. Requires documented reason. Creates `admin_actions` + `audit_logs` records. Generates compliance review record. |
| User requests account deletion | GDPR/CCPA flow: anonymize PII in `profiles`, delete documents from storage, retain `audit_logs` (regulatory requirement), set credential to `revoked`. |
| Same user creates multiple KYC submissions | Only one active case allowed (UNIQUE index). Previous rejected/expired cases kept for audit. |

### P2. Future Expansion

| Feature | When |
|---|---|
| On-chain verifiable credentials (W3C VC) | V3 — after XRPL DID standard matures |
| Permissioned DEX integration | V3 — credential checked by DEX smart contract / hook |
| Issuer-controlled asset acceptance rules | V3 — issuers define who can hold their token; credential validates |
| Periodic automated re-screening | Phase 7 |
| Multi-jurisdiction KYC rules | V4 — different document requirements per country |
| Institutional / accredited investor verification | V4 |
| KYB (Know Your Business) for entity accounts | V4 |
| XRPL MPT `tfMPTRequireAuth` integration | After MPT mainnet activation — platform issues auth for compliant wallets |
| Sign In With XRPL | V3 — eliminate Supabase Auth dependency for wallet-native users |
| Credential NFT (on-ledger proof of KYC) | V3 |
