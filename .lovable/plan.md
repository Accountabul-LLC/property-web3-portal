# App-Wide Latency Audit (Read-Only)

You want a full diagnostic pass on click-to-render latency across the app. No fixes. Just measurements + a ranked report of root causes per page/interaction.

## Scope

Every primary route and the high-traffic UI interactions (nav clicks, Sign In button, tab switches inside pages like Portfolio, Property Detail, Vendor Public Profile, Admin).

## What I'll measure

For each page I'll capture:

1. **Route chunk load** — size of the lazy-loaded JS chunk, time spent downloading/parsing.
2. **Time to first paint after click** — using `browser--performance_profile` (FCP, LCP, INP) and CPU profiling (`start_profiling` → click → `stop_profiling`) to see what JS is blocking.
3. **Network waterfall** — every XHR/fetch the page fires on mount, ordered by start time, with duration. Flags duplicates, sequential chains, and edge-function cold starts.
4. **React Query hooks fired on mount** — list each `useQuery`, its key, `enabled` gate, `staleTime`, and whether it triggers an edge function or PostgREST call.
5. **Code-level red flags** — heavy imports, top-level `useEffect` chains, blocking auth/role checks, components rendered before `isLoading` resolves.

## Output: `docs/PERF_AUDIT_2026-06-16.md`

Single markdown report, organized as:

### Section A — Summary table

| Route | Click→FCP | Click→LCP | # XHR on mount | Largest blocker | Verdict |
|---|---|---|---|---|---|
| /auth | … | … | … | … | … |
| /dashboard | … | … | … | … | … |
| … one row per route … |

### Section B — Per-route findings

For each route covered:
- Chunk size + parse time
- Network waterfall (top 10 requests with start/duration)
- React Query hooks list (key, edge fn, stale/refetch config)
- Specific code red flags with file:line
- Ranked root causes for the latency (1 = biggest)

### Section C — Cross-cutting findings

- Edge functions called from many pages (cold-start amplification)
- Hooks that fire regardless of route (`WalletActivityWatcher`, `useAuth`, `useWalletCompliance`, etc.)
- Shared providers in `App.tsx` that run on every navigation
- React Query global config vs. per-hook overrides
- Patterns where UI renders before role/auth resolves (flash of unauthorized + extra round-trips)

### Section D — Sign In button specifically

User flagged Sign In as 3–4 seconds. Dedicated sub-section:
- Trace: click on Nav → navigate to `/auth` → render → form interactive
- Measure each phase
- Identify whether the delay is (a) route chunk download, (b) `useAuth` blocking, (c) Supabase session check on `/auth` mount, (d) form-level effects, or (e) something else

### Section E — Ranked root causes (whole app)

Top 10 latency contributors ordered by user-perceived impact, with file:line references and what would fix each (without actually changing code).

## How I'll run it

1. Code survey: read `App.tsx`, `Navigation.tsx`, `useAuth.ts`, `RouteGuard.tsx`, `KycGate.tsx`, `RouteSeo.tsx`, `WalletActivityWatcher.tsx`, and the top of every page component (`useEffect`/`useQuery` block only).
2. Vite bundle inspection: list chunk sizes from a build manifest read (no rebuild, just inspecting what's there).
3. Browser session: for each route — `view_preview` → `performance_profile` → `list_network_requests` → optional `start/stop_profiling` around a click. Repeat for the Sign In click flow.
4. Database side: `supabase--slow_queries` to capture any slow PostgREST/RPC calls hit during the run.
5. Edge function cold-start sampling: time `xrpl-account-data`, `xrpl-token-meta`, `compliance-check`, and any other edge fn that fires on common pages using `supabase--curl_edge_functions`.

## Constraints

- Read-only. No code edits. No migrations. No restarts.
- Will use a sub-agent to parallelize the per-route code scan so this finishes in one pass.
- Auth-gated pages are measured logged in (current preview session). If a page redirects to `/auth`, that's a finding, not a failure.

## Deliverable

A single committed markdown file at `docs/PERF_AUDIT_2026-06-16.md` plus a short chat summary pointing at the top 3 culprits. You can then decide which ones to act on.

Approve and I'll run the audit.
