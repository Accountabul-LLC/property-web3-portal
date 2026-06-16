# Fix Wallet Data Performance: Persistent Cache + React Query Tuning

Yes, the diagnosis lines up with what we found. Here's a concrete plan to address all three culprits without changing any user-facing behavior.

## What we'll change

### 1. Persistent server-side cache for `xrpl-account-data`

Add a Postgres-backed cache table so cold-start workers don't re-run 5 sequential XRPL RPC calls.

- New table `xrpl_account_cache`:
  - `wallet_address text`, `network text`, `payload jsonb`, `fetched_at timestamptz`, primary key `(wallet_address, network)`.
  - GRANT to `service_role` only (edge function writes), RLS enabled, no client policies — clients never touch this directly.
- Edge function (`supabase/functions/xrpl-account-data/index.ts`):
  - On request: read row, if `fetched_at` is within **fresh TTL (30s)** → return immediately.
  - If within **stale TTL (5 min)** → return cached payload AND kick off background refresh via `EdgeRuntime.waitUntil` (stale-while-revalidate).
  - If older or missing → do full 5-RPC fetch, write to table, return.
  - Keep the in-memory Map as a hot L1 cache in front of Postgres (still useful within a single worker).
  - Add a single-flight lock (in-memory Map of in-flight promises keyed by address+network) so duplicate concurrent calls from `useXRPLPortfolio` + `WalletActivityWatcher.backfill()` collapse into one upstream fetch.

### 2. Persistent cache for `xrpl-token-meta`

Same pattern, scoped per token.

- New table `xrpl_token_meta_cache`:
  - `currency text`, `issuer text`, `meta jsonb`, `price_xrp numeric`, `fetched_at timestamptz`, primary key `(currency, issuer)`.
  - Plus a singleton row for `xrp_usd` price (`key text primary key`, `value numeric`, `fetched_at`).
- Edge function (`supabase/functions/xrpl-token-meta/index.ts`):
  - For each requested token, look up cache row. Fresh (< 60s) → use it. Stale (< 30 min) → use it + queue background refresh. Missing/expired → fetch from `s1.xrplmeta.org`, upsert.
  - XRP/USD price: cache for 60s in Postgres; cuts CoinGecko hits down to ~1/minute across all callers.
  - Per-token fetches stay parallel via `Promise.all`, but only for tokens that actually need a refresh.

### 3. React Query tuning

Frontend-only adjustments to stop redundant fetches.

- `src/hooks/useXRPLPortfolio.ts`:
  - Remove `refetchOnMount: 'always'` (let `staleTime` do its job).
  - Bump `staleTime` to **60s** (matches cache fresh window).
  - Keep `refetchInterval: 90_000`.
- `src/hooks/useTokenMeta.ts`:
  - Bump `staleTime` to **60s** and `refetchInterval` to **60_000** (cuts polling from 6×/min to 1×/min; server cache absorbs the rest).
- `src/hooks/useWalletCompliance.ts`:
  - Set `staleTime: 30_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: false`.
- `src/App.tsx` QueryClient:
  - Add sane defaults: `staleTime: 30_000`, `refetchOnWindowFocus: false`, `refetchOnMount: true` (the React Query default, but explicit).
- `src/components/WalletActivityWatcher.tsx`:
  - Stop calling `xrpl-account-data` directly from `backfill()`. Reuse the `useXRPLPortfolio` cache via `queryClient.fetchQuery` with the same key, so we never double-invoke the edge function.

## What we're NOT touching

- Transports stay the same: WebSocket for live XRPL tx, Supabase Realtime for notifications, HTTPS for everything else. No SSE work.
- No changes to `account_tx` limits, XRPL node failover, or auth/RLS.
- `compliance-check` internals stay as-is for now (we'll just stop hammering it from the client).

## Expected impact

- First load after worker cold start: ~3 min → **under 2 s** (served from Postgres cache).
- Steady-state polling: token-meta external calls drop ~95% (1 call/min/token max, deduped across users).
- Navigation between pages: no more full refetch on every mount.

## Technical notes

- Stale-while-revalidate uses `EdgeRuntime.waitUntil(...)` so the response returns immediately while the refresh runs.
- Cache writes use `INSERT ... ON CONFLICT DO UPDATE` keyed on the primary key.
- Single-flight dedup uses a module-scoped `Map<string, Promise>` cleared in `.finally()`.
- No new secrets needed. No client API changes. Types in `useXRPLPortfolio` / `useTokenMeta` are unchanged.
- Migration includes GRANTs (`service_role` only) and `ENABLE ROW LEVEL SECURITY` with no client-facing policies.

Approve and I'll implement.
