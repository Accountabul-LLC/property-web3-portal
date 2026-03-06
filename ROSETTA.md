# Rosetta — Property Web3 Portal (RWA)

> An RWA tokenization platform on the XRP Ledger: tokenize real estate as MPT/NFT/IOU tokens, connect wallets via Xaman, and manage fractional property ownership.

<!-- rosetta:sections:
overview
tech stack
architecture
directory structure
conventions
entry points
key patterns
module index
gotchas
agent notes
-->

## Overview

Property Web3 Portal is a React + Supabase web app that lets users tokenize real-world real estate assets on the XRP Ledger (XRPL) as Multi-Purpose Tokens (MPT), NFTs, or IOU tokens. Users authenticate via Supabase Auth (email/Google OAuth) and connect XRPL wallets through Xaman (formerly XUMM). The platform supports property listings, fractional ownership tracking, a portfolio dashboard, and an internal AI Panel (team-only) where Claude and ChatGPT collaborate on RWA questions.

Built with Lovable (auto-syncs commits to GitHub). V1 prototype — a spec-driven V2 rebuild is planned.

## Tech Stack

- **Language:** TypeScript 5.5
- **Framework:** React 18 + Vite 5 (SWC)
- **Styling:** Tailwind CSS 3 + shadcn/ui (Radix UI primitives)
- **State/Data:** TanStack React Query v5
- **Routing:** React Router DOM v6
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions in Deno)
- **Blockchain:** XRPL (XRP Ledger) via Supabase edge functions — no direct browser → XRPL
- **Wallet:** Xaman (QR-code signing), Supabase Auth (email/Google)
- **Key libs:** `@supabase/supabase-js@2`, `qrcode.react`, `html5-qrcode`, `recharts`, `zod`, `react-hook-form`

## Architecture

```
Browser (React)
    │
    ├── Supabase Auth ──────────── auth.users + profiles table
    │       │
    │       └── user_roles ──────── app_role: admin | moderator | user
    │
    ├── ActiveWalletContext ────── global XRPL wallet state + inactivity timeout
    │
    ├── Supabase DB (PostgreSQL)
    │       ├── properties, portfolio_holdings, portfolio_transactions
    │       ├── user_wallets (links user_id → XRPL r-address)
    │       ├── wallet_profiles, wallet_audit_log
    │       ├── professionals, ai_agents, service_bookings
    │       ├── token_mints, token_orders, token_price_history
    │       ├── ai_debate_sessions  ← team-only AI Panel sessions
    │       └── newsletter_subscribers, saved_properties, property_reviews
    │
    └── Supabase Edge Functions (Deno)
            ├── xaman-create-payload    ← XRPL wallet connect via QR
            ├── xaman-check-payload     ← poll Xaman sign status
            ├── xaman-send-payment      ← XRPL payment via Xaman
            ├── xrpl-account-data       ← fetch account info
            ├── xrpl-build-mint         ← build MPT/NFT/IOU mint tx
            ├── xrpl-build-payment      ← build XRP payment tx
            ├── xrpl-build-token-payment← build token transfer tx
            ├── xrpl-submit-signed      ← submit signed tx to XRPL
            ├── xrpl-testnet-faucet     ← fund testnet wallet
            ├── xrpl-token-meta         ← fetch MPT metadata
            ├── tokenization-pipeline   ← admin: manage property tokenization
            ├── wallet-audit-log        ← write audit events
            ├── places-autocomplete     ← Google Places API proxy
            ├── places-details          ← Google Places detail proxy
            └── ai-debate               ← team-only: Claude + GPT debate stream
```

## Directory Structure

```
src/
├── pages/              # Route-level components (1 per route)
│   ├── Index.tsx       # Landing page
│   ├── AIAgents.tsx    # /ai-agents — Marketplace tab + AI Panel tab (team-only)
│   ├── Auth.tsx        # /auth — login/signup
│   ├── Dashboard.tsx   # /dashboard — user home
│   ├── Marketplace.tsx # /marketplace — property listings
│   ├── Mint.tsx        # /mint — token minting wizard
│   ├── Portfolio.tsx   # /portfolio — holdings + transactions
│   ├── PropertyDetail.tsx  # /property/:id
│   ├── Tokenize.tsx    # /tokenize — submit property for tokenization
│   └── Professionals.tsx   # /professionals — service marketplace
│
├── components/
│   ├── ui/             # shadcn/ui primitives (DO NOT edit manually)
│   ├── ai-panel/       # Team-only AI debate panel
│   │   ├── AIPanel.tsx         # Main panel orchestrator
│   │   ├── AIPanelGate.tsx     # Lock screen for non-team users
│   │   ├── DebateControls.tsx  # Topic/mode/rounds form + start/stop
│   │   └── DebateTurn.tsx      # Single AI message card (streaming)
│   ├── mint/           # Token minting wizard steps
│   ├── property/       # Property detail sub-components
│   └── [feature].tsx   # Top-level feature sections (used by pages)
│
├── hooks/
│   ├── useAuth.ts              # Supabase session + user state
│   ├── useTeamAccess.ts        # Checks user_roles for admin — team gate
│   ├── useDebateSession.ts     # AI Panel stream state + fetch logic
│   ├── useProfile.ts           # User profile from profiles table
│   ├── useProperties.ts        # Property listings query
│   ├── usePortfolio.ts         # Portfolio holdings
│   ├── useXRPLPortfolio.ts     # XRPL on-chain portfolio data
│   ├── useXRPLSubscription.ts  # Real-time XRPL ledger subscription
│   ├── useTokenMeta.ts         # MPT metadata via edge function
│   ├── useTokenizeForm.ts      # Tokenization form state
│   ├── useAIAgents.ts          # ai_agents table query
│   ├── useInactivityTimeout.ts # Auto-logout after inactivity
│   └── useProfessionals.ts     # Professionals table query
│
├── contexts/
│   └── ActiveWalletContext.tsx # Global: connected wallet, inactivity, audit log
│
└── integrations/
    └── supabase/
        ├── client.ts   # createClient — import from here always
        └── types.ts    # Auto-generated DB types (DO NOT edit manually)

supabase/
├── config.toml         # Project ref: bmxcjxtjujhwreduwtvz, all functions verify_jwt=false
├── functions/          # Deno edge functions (one folder per function)
└── migrations/         # Ordered SQL migrations (applied to bmxcjxtjujhwreduwtvz)

docs/
├── PRD.md              # Wallet/send flow product requirements
├── TECHNICAL_SPEC.md   # Edge function specs
├── ARCHITECTURE.md     # Full architecture doc
├── CODE_AUDIT.md       # V1 audit findings (known issues)
├── AUTH_SYSTEM.md      # Dual auth system documentation
├── MPT_MINTING.md      # MPT minting spec (XLS-89 standard)
└── AI_DEBATE_PANEL.md  # AI Panel feature spec
```

## Conventions

- **Imports:** Always `import { supabase } from '@/integrations/supabase/client'` — never create a new client
- **Types:** Use generated types from `@/integrations/supabase/types` — `Tables<'tablename'>` pattern
- **Components:** PascalCase files. One default export per file. Co-locate with hook if tightly coupled.
- **Hooks:** `use` prefix, camelCase. Return plain object `{ data, loading, error }` or action functions.
- **Edge functions:** All use `verify_jwt = false` (manual JWT check inside). Pattern: CORS preflight → auth check → role check → business logic.
- **Styling:** Tailwind utility classes only. Use `cn()` from `@/lib/utils` for conditional classes.
- **Forms:** `react-hook-form` + `zod` for validation.
- **Toasts:** `sonner` via `toast.success/error/info`.
- **No direct XRPL from browser** — always proxy through edge functions.

## Entry Points

| File | Purpose |
|------|---------|
| `src/main.tsx` | App bootstrap |
| `src/App.tsx` | Router + global providers (ThemeProvider, QueryClientProvider, ActiveWalletProvider) |
| `src/integrations/supabase/client.ts` | Supabase client singleton |
| `src/contexts/ActiveWalletContext.tsx` | Global wallet state — wrap any wallet-aware component |
| `supabase/config.toml` | Project config + function settings |

## Key Patterns

### 1. Edge Function Auth + Role Check
Every protected edge function follows this exact pattern:
```typescript
// 1. CORS preflight
if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

// 2. Verify JWT via anon client
const supabaseUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
const { data: { user } } = await supabaseUser.auth.getUser()
if (!user) return new Response('Unauthorized', { status: 401 })

// 3. Role check via service role client
const supabaseAdmin = createClient(url, serviceRoleKey)
const { data: roleRow } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
if (!roleRow) return new Response('Forbidden', { status: 403 })
```

### 2. Team Access Gate (client-side)
```typescript
// Any team-only UI uses useTeamAccess():
const { hasAccess, loading } = useTeamAccess()
// hasAccess = true only if user has 'admin' role in user_roles table
// Always pair with server-side check — client gate is UX only
```

### 3. Supabase Query Hook
```typescript
export function useMyData() {
  return useQuery({
    queryKey: ['my_data'],
    queryFn: async () => {
      const { data, error } = await supabase.from('my_table').select('*')
      if (error) throw error
      return data
    }
  })
}
```

### 4. AI Panel Streaming (NDJSON)
```typescript
// Client reads line-by-line from ai-debate edge function stream:
// Events: turn_start | chunk | turn_end | done | error
// useDebateSession.ts manages AbortController, turn state, save
```

## Module Index

| Module | Path | Description | Load When |
|--------|------|-------------|-----------|
| Auth | `.rosetta/modules/auth.md` | Dual auth: Supabase + Xaman wallet | Working on login, wallet connect, session, RLS |
| AI Panel | `.rosetta/modules/ai-panel.md` | Team-only Claude+GPT debate feature | Working on AI Panel, edge fn, team access |
| XRPL | `.rosetta/modules/xrpl.md` | MPT/NFT/IOU minting, payments, XRPL edge fns | Working on tokenization, wallet, payments |

### Module Loading Policy

- Always load this root `ROSETTA.md` first (~1,400 tokens).
- Load a module only when your task touches that subsystem.
- Module definitions override root for their scoped area.
- Agents: never drop loaded modules mid-task.

## Gotchas

- **`supabase/types.ts` is auto-generated** — never edit it; Lovable regenerates it on schema changes
- **`src/components/ui/` is auto-generated** — shadcn components; edit only if you know what you're doing
- **Security issue C1:** `wallet_secret` stored in plain text in `user_wallets` table (testnet only — do not use in production)
- **`verify_jwt = false` on all edge functions** — JWT is manually verified inside each function; Supabase gateway does NOT enforce it
- **XRPL never called from browser** — all XRPL interactions go through edge functions; never import xrpl SDK in frontend
- **Team access = `admin` role in `user_roles`** — no separate `team` role yet; to grant access: `insert into user_roles (user_id, role) values ('<uuid>', 'admin')`
- **Lovable auto-commits** — commits pushed to GitHub from Lovable will overwrite local changes unless you pull first
- **`ai_agents` table is empty** — Marketplace tab on /ai-agents shows no data; seeding needed
- **New Supabase project:** `bmxcjxtjujhwreduwtvz` (Aiagentboard) — old project was `gveavwqyrwqvafsnhnqc`
- **MPT metadata:** XLS-89 compressed standard, max 1024 bytes — see `docs/MPT_MINTING.md`

## Agent Notes

<!--
  AGENTS: Append learnings below this line.
  Format: ### YYYY-MM-DD | agent-name
  Humans curate this section periodically.
-->

### 2026-03-06 | claude-sonnet-4-6
- Built AI Panel feature: `src/components/ai-panel/`, `src/hooks/useTeamAccess.ts`, `src/hooks/useDebateSession.ts`, `supabase/functions/ai-debate/index.ts`
- Migrated project to new Supabase instance `bmxcjxtjujhwreduwtvz`; fixed migration conflict in `20260303100331` by adding IF NOT EXISTS to wallet_profiles and xaman_payloads CREATE TABLE statements
- All 18 migrations applied; all 15 edge functions deployed
- ROSETTA.md and modules created for context efficiency

---

<!-- rosetta:version:1.0 -->
<!-- rosetta:last-updated:2026-03-06 -->
