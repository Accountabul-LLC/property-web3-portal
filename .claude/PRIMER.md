# RWA Context Primer

> Property Web3 Portal — XRPL RWA tokenization platform.
> Stack: React 18 + TypeScript + Vite + Supabase (gveavwqyrwqvafsnhnqc) + Tailwind/shadcn + Xaman wallet.
> Built via Lovable (auto-commits to GitHub on Lovable saves — pull before editing locally).

## Active Features

| Feature | Route(s) | Key Files |
|---|---|---|
| Auth | `/auth`, `/auth/individual`, `/auth/business`, `/auth/vendor` | `src/pages/Auth.tsx`, `AuthIndividual.tsx`, `AuthBusiness.tsx`, `AuthVendor.tsx` |
| KYC | `/kyc`, `/kyc/status` | `src/pages/Kyc.tsx`, `KycStatus.tsx`, `src/components/KycGate.tsx` |
| Vendor Onboarding | `/vendor`, `/vendor/onboarding`, `/vendor/status`, `/vendor/dashboard` | `src/pages/Vendor.tsx`, `VendorOnboarding.tsx`, `src/lib/vendorFlow.ts`, `src/hooks/useVendorApplication.ts` |
| Wallet Compliance | (modal/panel) | `src/components/WalletRegistrationPanel.tsx`, `TradeGuard.tsx`, `src/hooks/useWalletCompliance.ts` |
| Property Tokenization | `/tokenize`, `/mint` | `src/pages/Tokenize.tsx`, `Mint.tsx`, `src/components/mint/*`, `supabase/functions/xrpl-build-mint` |
| Payments | `/payments`, `/payments/history`, `/payments/:id`, `/admin/payments` | `src/pages/Payments.tsx`, `PaymentsHistory.tsx`, `PaymentDetail.tsx`, `AdminPayments.tsx` |
| Causes | `/causes`, `/causes/:slug`, `/causes/apply`, `/causes/my-donations` | `src/pages/Causes.tsx`, `CauseDetail.tsx`, `CauseApply.tsx`, `MyDonations.tsx` |
| AI Panel | `/ai-agents` (team/admin only) | `src/pages/AIAgents.tsx`, `src/components/ai-panel/*`, `supabase/functions/ai-debate` |
| Treasury | `/treasury` | `src/config/treasuryWallets.ts` (address is optional — guard for placeholders) |
| Admin Credentials | `/admin/credentials` | `src/pages/AdminCredentials.tsx`, edge fns: `issue-testnet-credential`, `revoke-credential` |

## Slash Command Routing

| Command | Action |
|---|---|
| `/products` | Read `.claude/PRODUCT_REGISTRY.json` — summarize by status |
| `/causes` | Load Causes feature files only |
| `/payments` | Load Payments feature files only |
| `/vendor` | Load Vendor onboarding files only |
| `/auth` | Load Auth pages + `AuthForm.tsx` |
| `/kyc` | Load KYC pages + `KycGate.tsx` |
| `/ai-panel` | Load `src/components/ai-panel/*` + `ai-debate` edge fn |
| `/ideas` | List Future section of this file — do not build yet |
| `/compare` | Discovery + gap report only — no file edits |
| `/build` | Begin implementation — only after scope is confirmed |

## Gotchas

- `wallet_secret` in `user_wallets` = plaintext testnet key — **never mainnet**
- All edge fns use `verify_jwt=false` — JWT verified manually inside each fn
- No XRPL calls from browser — always proxy through edge functions
- `APP_ALLOWED_ORIGIN` + `STRIPE_IDENTITY_WEBHOOK_SECRET` secrets required before mainnet
- `ai_agents` table is empty — Marketplace tab has no data (needs seeding)
- `supabase/types.ts` and `src/components/ui/` are auto-generated — do not edit manually

## Future Ideas

| Idea | Trigger Words |
|---|---|
| Vendor CRM / Admin Review Tools | vendor CRM, admin vendor tools, vendor management |
| Accredited Investor Verification | accredited investor, SEC, investor gate |
| Future Product Ideas Index | new idea, roadmap, not yet built |

## Deep Dive Pointers

- Full architecture + conventions: `ROSETTA.md` (load only when touching arch/XRPL/AI Panel)
- Product lifecycle tracker: `.claude/PRODUCT_REGISTRY.json`
- Module detail: `.rosetta/modules/auth.md`, `xrpl.md`, `ai-panel.md`
- Spec docs: `docs/PRD.md`, `docs/TECHNICAL_SPEC.md`, `docs/CODE_AUDIT.md`
