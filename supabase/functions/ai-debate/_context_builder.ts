// Run this once to print the JSON payload for setting CODEBASE_CONTEXT secret
// Not imported by the main function — just a helper script

const context = `# Property Web3 Portal — Codebase Context

## Overview
React + Supabase RWA tokenization platform on XRPL. Tokenize real estate as MPT (Multi-Purpose Tokens), NFTs, or IOU tokens. Auth via Supabase (email/Google) + Xaman wallet (XRPL QR signing). V1 prototype, V2 rebuild planned. Hosted on Lovable, auto-syncs to GitHub (JibreelMuhammad/property-web3-portal).

## Tech Stack
- React 18 + Vite 5 + TypeScript 5.5
- Tailwind CSS + shadcn/ui (Radix primitives)
- TanStack React Query v5, React Router v6
- Supabase (PostgreSQL + Auth + Deno Edge Functions)
- XRPL via edge functions only — NO direct browser calls
- Xaman wallet (QR signing), Supabase Auth (email/Google OAuth)

## Key Architecture
Browser to Supabase Edge Functions to XRPL/external APIs.
Browser to Supabase DB (PostgreSQL with RLS).
Auth: Supabase session JWT + user_roles table (app_role: admin|moderator|user).
Team access = admin role. Wallet state = ActiveWalletContext (global).

## Main Routes
/ = landing, /auth = login, /dashboard = user home
/marketplace = property listings, /property/:id = detail
/tokenize = submit property, /mint = token minting wizard
/portfolio = holdings, /professionals = service marketplace
/ai-agents = AI Agent Marketplace + AI Panel tab (admin only)

## Key Files
src/pages/ — one component per route
src/components/ui/ — shadcn primitives (DO NOT edit)
src/components/ai-panel/ — AIPanel, AIPanelGate, DebateTurn, ChatInputBar, ActionableConclusions
src/components/mint/ — MintWizard, MPTForm, NFTForm, IOUForm, MintStatus
src/hooks/ — useAuth, useTeamAccess, useDebateSession, useProfile, useProperties, usePortfolio, useXRPLPortfolio, useTokenMeta, useAIAgents
src/contexts/ActiveWalletContext.tsx — global wallet state + inactivity timeout
src/integrations/supabase/client.ts — Supabase singleton (always import from here)
src/integrations/supabase/types.ts — auto-generated DB types (never edit)

## DB Tables (project: bmxcjxtjujhwreduwtvz)
auth.users + profiles, user_roles (admin|moderator|user), user_wallets
wallet_profiles, wallet_audit_log
properties, property_documents, property_reviews, saved_properties
portfolio_holdings, portfolio_transactions
token_mints, token_orders, token_price_history
ai_agents, ai_debate_sessions
professionals, service_bookings
kyc_cases, kyc_form_data, kyc_documents, kyc_status_history
newsletter_subscribers, xaman_payloads

## Edge Functions (verify_jwt=false, manual JWT inside)
xaman-create-payload, xaman-check-payload, xaman-send-payment
xrpl-account-data, xrpl-build-mint, xrpl-build-payment, xrpl-build-token-payment, xrpl-submit-signed, xrpl-testnet-faucet, xrpl-token-meta
tokenization-pipeline, wallet-audit-log
places-autocomplete, places-details
ai-debate (this function — streams Claude + GPT)

## Conventions
- Import supabase from @/integrations/supabase/client only
- Use Tables<'tablename'> for DB types
- Edge fn: CORS preflight, JWT verify, role check, business logic
- Tailwind + cn() for styling, react-hook-form + zod for forms, sonner for toasts
- Never call XRPL from browser

## Gotchas
- testnet wallet seeds are session-only; do not persist them in the database
- types.ts and components/ui/ are auto-generated — do not edit
- Lovable auto-commits to GitHub — pull before pushing
- ai_agents table is empty (marketplace needs seeding)
- KYC pages exist but edge functions are incomplete`

console.log(JSON.stringify(context))
