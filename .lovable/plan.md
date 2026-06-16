# Plan B — Batch Edge Function for Unified Wallets

Collapse the per-wallet fan-out in `UnifiedWalletsOverview` from `2N` HTTP edge invocations to `2` total, while keeping every other surface (single-wallet Portfolio, Treasury, WS watcher) unchanged.

## 1. New edge function `xrpl-accounts-batch`

Path: `supabase/functions/xrpl-accounts-batch/index.ts`

- Input (zod-validated):
  ```ts
  { wallets: string[]  // 1..10, each a valid r-address
    network?: 'mainnet' | 'testnet' }
  ```
- For each wallet, run the same 5 `rippled` calls as `xrpl-account-data` but:
  - All wallets processed via `Promise.allSettled` in parallel.
  - Per-wallet, a hard 4 s timeout (`Promise.race`).
  - Reuse the existing `xrpl_account_cache` (Postgres L2, 30 s fresh / 5 min stale-while-revalidate) — so warm wallets cost ~0 ms.
- Output:
  ```ts
  { accounts: { [address]: XRPLPortfolioData | { error: string } },
    network: 'mainnet' | 'testnet' }
  ```
- Share parsing helpers with `xrpl-account-data` by extracting them into `supabase/functions/_shared/xrpl-parse.ts` (move `parseMPTIssuances`, `parseMPTHoldings`, `parseTransactions`, `decodeHexString`, label maps). `xrpl-account-data` keeps working by importing from the shared module.
- CORS + `parseJsonBody` patterns identical to existing functions. `verify_jwt = false` (default).

## 2. Client batch hook

Path: `src/hooks/useXRPLPortfolioBatch.ts` (new)

- Single `useQuery` keyed on `['xrpl_portfolio_batch', network, addresses.sort().join(',')]`.
- `staleTime: 60_000`, `gcTime: 5 * 60_000`, `refetchInterval: 90_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: false`.
- On success, **seed each per-wallet React Query cache** so `useXRPLPortfolio` and `WalletActivityWatcher` continue to read from the shared cache without making their own calls:
  ```ts
  queryClient.setQueryData(['xrpl_portfolio', addr, network], data)
  ```
- Returns `{ accounts, isLoading, error }`.

## 3. Token meta consolidation

- `xrpl-token-meta` already accepts up to 20 tokens per request and already has SWR caching — no edge change needed.
- In `UnifiedWalletsOverview`, replace the per-wallet `metaQueries` `useQueries` with **one** `useQuery` whose body is the **deduplicated union** of `currency:issuer` pairs across all wallets (cap at 20; if exceeded, fall back to the largest 20 by balance — rare in practice for connected-wallet sets).
- Key: `['token_meta_batch', sortedUnionKey]`. Same staleness as today.
- Per-wallet rendering reads from the single `tokenMap`.

## 4. Refactor `UnifiedWalletsOverview.tsx`

- Drop both `useQueries` blocks.
- Add `useXRPLPortfolioBatch(addresses, network)` + the single token-meta query.
- Replace `portfolioQueries[idx].data` reads with `accounts[address]`.
- Loading state: show skeleton row only while the batch query is in `isLoading`; individual wallet failures render an inline "Couldn't load" hint instead of blocking the whole card.
- No UI/markup changes — same rows, same expand behavior.

## 5. Things explicitly NOT changing in this plan

- `useXRPLPortfolio` (single-wallet) — unchanged. Still used by `PortfolioSection`, `Treasury`, etc. It will now usually hit a warmed `xrpl_account_cache` row populated by the batch call.
- `WalletActivityWatcher` and `useXRPLSubscription` — unchanged (still one WS for the active wallet).
- `xrpl-account-data` edge function — unchanged externally; only its parsing helpers move to a shared module.
- Polling cadence and persistence layer — Plan A/C territory; deferred until after WalletConnect V2 lands.

## Verification

- Open `/portfolio` with 2+ wallets connected, watch the network tab: expect **1** call to `xrpl-accounts-batch` + **1** call to `xrpl-token-meta` instead of `2N`.
- Switch active wallet: `PortfolioSection` should render instantly from the seeded cache, no new edge call.
- Add a wallet: batch query key changes → one new batch call covers all wallets.
- Force a wallet to fail (bad address impossible due to validation; simulate by stopping nodes temporarily) → other wallets still render.

## Files

- `supabase/functions/_shared/xrpl-parse.ts` (new)
- `supabase/functions/xrpl-accounts-batch/index.ts` (new)
- `supabase/functions/xrpl-account-data/index.ts` (import from shared module)
- `src/hooks/useXRPLPortfolioBatch.ts` (new)
- `src/components/UnifiedWalletsOverview.tsx` (rewrite data layer, keep markup)
