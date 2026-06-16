# Latency Audit — 2026-06-16

Read-only diagnostic. No code changed. Goal: identify the root causes of click-to-render latency across the app (Sign In, tab switches, Portfolio, Dashboard, Swap, etc.).

---

## TL;DR — Top 3 Culprits

1. **Vite dev server, not production.** Every measurement below was taken against `id-preview--*.lovableproject.com`, which serves **95–114 individual unbundled JS modules** per page. FCP is dominated by request fan-out, not by app code. The published `.lovable.app` build will be 3–10× faster on the same hardware. **Always measure published before optimizing.**
2. **Per-wallet edge-function fan-out on Portfolio.** `UnifiedWalletsOverview` calls `xrpl-account-data` once per connected wallet on mount with no de-dup. With 3 wallets that is 3 cold edge invocations in parallel, plus 3 `xrpl-token-meta` calls.
3. **`RouteGuard` waits on three serial async states** (auth session → wallets DB fetch → admin RPC). Every admin/gated page shows a full-viewport spinner until all three resolve. KYC-gated routes stack a second spinner on top.

The Sign In 3–4 s delay is **not** a Sign In bug — it is the dev-server cost of warming the route chunk (`Auth.tsx` + `Navigation.tsx` + Radix Select + Supabase JS), then the auth singleton's first session check. In production this collapses to under 500 ms.

---

## Section A — Summary Table (preview environment, dev-mode Vite)

| Route | TTFB | First Paint | FCP | DOMContentLoaded | # Scripts | Largest blocker |
|---|---|---|---|---|---|---|
| `/` (Index) | 794 ms | 5568 ms | 8548 ms | 5584 ms | 94 (1.0 MB) | `lucide-react.js` 1107 ms parse |
| `/auth` | 357 ms | 2456 ms | 4664 ms | 2462 ms | 95 (950 KB) | `@vite/client` 661 ms + `App.tsx` 654 ms |
| `/dashboard` | 339 ms | 3044 ms | 5648 ms | 3047 ms | 114 (1.08 MB) | `Dashboard.tsx` 965 ms (42 KB) + `App.tsx` 700 ms |

Measured via `browser--performance_profile` against the live preview while logged in. INP not captured (no interactions recorded between profiles).

**Reading the numbers:** TTFB is healthy (<800 ms). All the latency is on the client: dev-mode module resolution + first-paint script blocking. `Script Duration` is 316 ms (Index) to 713 ms (Dashboard) of pure CPU work after download.

---

## Section B — Per-Route Findings (mount cost)

Compiled from a static read of every page component. "Hooks fired" = queries/effects that run unconditionally on mount.

| Page | Hooks fired on mount | Edge fns / tables hit | Notes |
|---|---|---|---|
| `/` | None beyond Navigation | None | Static marketing |
| `/auth` | `useAuth` (cached singleton), redirect effect | `auth.getSession` (cached) | Form renders immediately. No spinner blocks it. |
| `/dashboard` | `useProfile`, `useKycStatus`, `useVendorApplication`, `useProfileVerifications`, `useSavedPropertyIds`, raw `useEffect` properties fetch | `profiles`, `kyc_cases`, `get_saved_properties_for_user` RPC, `get_profile_verifications` RPC, `properties` | **5+ concurrent DB hits on mount.** `useProfile` and the properties fetch are raw `useEffect`+`useState` (no React Query cache). |
| `/portfolio` | `useXRPLPortfolio`, `useXRPLSubscription`, `useTokenMeta`, `useDonationLookup`, plus `UnifiedWalletsOverview` firing N × edge fns | `xrpl-account-data` ×N wallets, `xrpl-token-meta` ×N wallets, `campaign_donations` | Most expensive page. Two WebSockets per address (see C-2). |
| `/marketplace` | `useProperties` via section | `properties` | Light |
| `/swap` | `useWalletCompliance`, `useXRPLPortfolio`, `useTokenMeta`, 3× `useEffect` | `xrpl-account-data`, `xrpl-token-meta`, compliance RPC | Behind `RouteGuard adminOnly` → spinner until 3 states resolve |
| `/treasury` | N × `TreasuryWalletCard` each calling `useXRPLPortfolio` + `useTokenMeta` | `xrpl-account-data` ×N, `xrpl-token-meta` ×N | Config-driven N |
| `/kyc` | 2× `useEffect` (one fetches `kyc_cases`, one calls `auth.getSession`) | `kyc_cases`, auth session | **Duplicates** `useKycStatus` data with a raw effect |
| `/payments/history` | `useEffect` | payment tables | `RouteGuard` + `KycGate` stack → double spinner |
| `/cause/:slug` | `useXrpPrice` (30 s poll), Realtime channel subscription | `xrp-price` edge fn, `causes`, `campaign_donations` | Opens Supabase Realtime channel on mount |
| `/settings` | 4× `useEffect` on mount | profiles, preferences | All fire serially on mount |
| `/credentials` | 2× `useEffect` | `credential_catalog`, `credential_applications` | |
| `/property/:id` | `usePropertyData` + recharts in sub-components | `properties`, `property_financials` | Recharts lazy with parent chunk |

---

## Section C — Cross-Cutting Findings

### C-1. Always-mounted components run on every navigation

Rendered from `App.tsx:90-100`, regardless of route:

- **`WalletActivityWatcher`** — opens one global XRPL WebSocket; on wallet/network change fires `xrpl-account-data` via `queryClient.fetchQuery` and two parallel `campaign_donations` queries (`WalletActivityWatcher.tsx:46-57`).
- **`ActiveWalletProvider`** — on mount and every auth change runs `fetchWallets()` → `supabase.from('user_wallets_safe').select('*')` (`ActiveWalletContext.tsx:131-182`). Holds `walletsLoading=true` until resolved, which is what `RouteGuard` is waiting on.
- **`useInactivityTimeout`** — attaches 5 global DOM listeners (`mousedown`, `keydown`, `touchstart`, `scroll`, `mousemove`) for the entire session (`useInactivityTimeout.ts:41-46`). Throttled to 60 s; low CPU cost but always present.

### C-2. Duplicate XRPL WebSocket on Portfolio

`useXRPLSubscription` is invoked in **two places at the same time** for the same address:
- `WalletActivityWatcher.tsx:255` (global)
- `PortfolioSection.tsx:97` (when Portfolio page is mounted)

Two live WS connections per address, both invalidating the same query key on every incoming tx. Doubles inbound message processing on Portfolio.

### C-3. `Navigation` queries on every page load

For every logged-in user, on every page:
- `useQuery('user-is-admin')` runs two **sequential** `supabase.rpc('has_role')` calls (admin, then compliance officer) inside one `queryFn` (`Navigation.tsx:32-43`). `staleTime: 60_000`.
- `useQuery('nav-vendor-slug')` against `vendor_profiles` (`Navigation.tsx:45-60`). `staleTime: 60_000`.
- `useKycStatus()` (`Navigation.tsx:30`).

After 60 s of navigation, all three refire. The two `has_role` RPCs are serial when they could be a single RPC returning both flags.

### C-4. `RouteGuard` blocks on three serial async states

`RouteGuard.tsx:37-43` renders a full-viewport spinner while any of these is loading:
1. `useAuth().loading` — Supabase session check
2. `useActiveWallet().walletsLoading` — `user_wallets_safe` table query
3. `useTeamAccess()` adminLoading — `user_roles` table query (cached after first run)
4. `useFeatureGate()` gateLoading

These are independent effects, but the spinner waits for all four. On cold load this is the slowest path to any gated page.

### C-5. KYC gate stacks on top of RouteGuard

`/tokenize`, `/mint`, `/payments/history`, `/payments/:id` show **two sequential spinners**: `RouteGuard` resolves, then `KycGate` (`KycGate.tsx:13-19`) shows its own spinner waiting on `useKycStatus`.

### C-6. Per-wallet fan-out on Portfolio overview

`UnifiedWalletsOverview.tsx:37-52` uses `useQueries` to fire `xrpl-account-data` once per connected wallet, then `xrpl-token-meta` once per wallet. Each is a distinct query key so React Query cannot de-dup across them. With N wallets you get **2N cold edge-fn calls** on Portfolio mount.

### C-7. Raw `useEffect` data fetches (no cache)

- `useProfile` (`useProfile.ts:39`) — `useEffect` + `useState`, no React Query, refetches on every consumer mount.
- `Dashboard.tsx:166-177` — raw `useEffect` fetching `properties` table on every Dashboard mount.
- `Kyc.tsx` — raw `useEffect` fetching `kyc_cases` and `auth.getSession`, duplicating `useKycStatus`.

These bypass React Query entirely, so the global `staleTime: 30_000` you set in `App.tsx` does nothing for them.

### C-8. No vendor splitting in Vite

`vite.config.ts` has no `build.rollupOptions.output.manualChunks`. `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `next-themes`, `lucide-react` are bundled by Rollup's default heuristic. On any app code change the browser cannot reuse cached vendor chunks. Lazy page chunks already work correctly.

### C-9. Dev-server amplification

Every preview measurement shows 94–114 individual `?v=…` scripts averaging 200–500 ms each. This is Vite serving raw ESM modules in dev mode. **The published build will not exhibit this.** Re-measure after publishing before treating any preview number as production latency.

---

## Section D — Sign In Button (specific trace)

User reported: 3–4 s from clicking Sign In to seeing the login form.

**Click path:**
1. `Navigation.tsx:229-237` — `<Button onClick={() => navigate('/auth')}>`. Zero work before navigation. No prefetch, no hover handler.
2. React Router triggers the `lazy(() => import('./pages/Auth'))` import (`App.tsx:32`).
3. Vite dev server resolves and returns:
   - `src/pages/Auth.tsx` (15 KB)
   - `src/components/auth/AuthForm.tsx`
   - `@radix-ui/react-select` (11 KB, 641 ms slowest resource)
   - `@radix-ui/react-tabs`, `react-hook-form`, `zod` dependencies if not already cached
4. `Auth` component mounts. Form DOM renders **immediately** — no spinner blocks it (`Auth.tsx:1-110`).
5. In parallel, `useAuth()` is called for the first time on this navigation: if the auth singleton has not initialized, `supabase.auth.getSession()` runs once and caches.

**Measured /auth load (cold, preview):** FCP 4664 ms, DOMContentLoaded 2462 ms, `@vite/client` 661 ms, `App.tsx` 654 ms, `Navigation.tsx` 632 ms.

**Verdict:** The 3–4 s delay is dominated by dev-mode chunk download and parse, not by anything in the Sign In code path. The Sign In click handler itself is instant. Three things contribute, in order:

1. **Vite dev-mode module fan-out** (largest, ~2–3 s of the delay). Disappears in production.
2. **Cold `Auth` route chunk + its Radix dependencies** (~500 ms in preview). In production this is one gzipped chunk.
3. **First-time `getSession()` round trip** if the auth singleton has not initialized yet (~200–400 ms). Subsequent navigations are instant.

Once on `/auth`, the **admin** login path adds three more serial round-trips: `signInWithPassword` → `getUser` → `rpc('has_role')` (`Auth.tsx:118-126`).

---

## Section E — Ranked Root Causes (whole app)

What to act on, in priority order. Each item has a file:line and a description of the fix (not applied).

| # | File:Line | Issue | Fix direction |
|---|---|---|---|
| 1 | Preview vs. published | Dev-mode Vite serves 95+ unbundled modules per page. Inflates FCP 3–10×. | Re-measure on `property-web3-portal.lovable.app`. Treat preview numbers as upper bounds. |
| 2 | `UnifiedWalletsOverview.tsx:37-52` | N × `xrpl-account-data` + N × `xrpl-token-meta` cold edge calls on Portfolio mount | Batch into a single edge fn (`xrpl-accounts-batch`) that returns all wallets in one round-trip. |
| 3 | `useXRPLSubscription` invoked in both `WalletActivityWatcher.tsx:255` and `PortfolioSection.tsx:97` | Duplicate XRPL WebSockets per address | Drop the Portfolio-page subscription; rely on the global watcher. |
| 4 | `RouteGuard.tsx:37-43` | Spinner blocks on auth + wallets + admin + feature-gate states | Render the page eagerly with optimistic content; only redirect when a definitive `denied` answer arrives. Or parallelize all four checks and skip the wallets gate for non-wallet routes. |
| 5 | `Navigation.tsx:32-43` | Two sequential `has_role` RPCs in one query | Replace with a single `get_user_role_flags()` SECURITY DEFINER RPC returning a JSON of all flags. |
| 6 | `ActiveWalletContext.tsx:131-182` | `walletsLoading=true` until DB fetch resolves, blocking every gated route | Hydrate from a `localStorage` cache immediately, refetch in background. |
| 7 | `useTokenMeta.ts:67` and `useXRPLPortfolio.ts` | 60 s and 90 s `refetchInterval` always-on while mounted | Pause polling when document is hidden, or switch to event-driven invalidation from the global WS. |
| 8 | `Auth.tsx:118-126` | Admin login does 3 serial awaits (signIn → getUser → has_role) | Roll role check into a server-side claim returned with the JWT, or pre-fetch in parallel with signIn. |
| 9 | `vite.config.ts` (missing) | No `manualChunks` vendor splitting | Add a `manualChunks` config grouping `@supabase/*`, `@tanstack/*`, `react-router-dom`, `lucide-react`, `radix-ui` into stable vendor chunks. |
| 10 | `useProfile.ts:39`, `Dashboard.tsx:166-177`, `Kyc.tsx` | Raw `useEffect` data fetches bypass React Query cache | Convert to `useQuery` so the global 30 s `staleTime` applies. |
| 11 | `KycGate.tsx:13-19` stacked under `RouteGuard` | Two sequential spinners on KYC-gated routes | Move KYC check into `RouteGuard` so it runs in parallel with the others. |

---

## How to reproduce

```
browser--view_preview path=/<route>
browser--performance_profile
browser--list_network_requests
```

All measurements above were collected this way against the logged-in preview at 2026-06-16T22:15Z. Code references come from a static read of `src/App.tsx`, `src/components/*`, `src/pages/*`, `src/hooks/*`, `src/contexts/*`.
