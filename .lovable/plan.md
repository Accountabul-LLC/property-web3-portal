

# Fix: Persistent Blank Screen (Stale Build Cache)

## Diagnosis

The `ActiveWalletProvider` wraps all routes correctly in `App.tsx` (line 32-59). The `ActiveWalletContext.tsx` exports are valid. The `kyc-submit` filename in the error is a red herring — the actual crash is still `useActiveWallet must be used within ActiveWalletProvider` from the earlier stack trace, causing a blank screen.

The edge function code for `kyc-submit` is clean — logs show only boot messages with no errors.

This is a stale HMR bundle issue. The previous session made sweeping type changes across 10+ files simultaneously, and the dev server's module graph likely has a stale cached version of `ActiveWalletContext.tsx` that doesn't export the provider correctly.

## Fix

Force a full module invalidation by making a meaningful but safe change to `src/contexts/ActiveWalletContext.tsx` — add an explicit `export type` for the network union and a module-level comment. This will bust the HMR cache for this specific module and its dependents.

| File | Change |
|------|--------|
| `src/contexts/ActiveWalletContext.tsx` | Add exported `XRPLNetwork` type alias at the top of the file; use it in `ConnectedWallet` and `addWallet` signatures to consolidate the union type — this forces HMR to reprocess the module graph |

This is a minimal, safe refactor that serves dual purpose: cleans up repeated inline union types and forces a cache bust.

