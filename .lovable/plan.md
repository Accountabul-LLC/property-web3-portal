

## Fix: Blank Screen and kyc-save Edge Function

There are two issues to address:

### 1. kyc-save duplicate line (minor)
Line 88 has a duplicate `source_of_funds: source_of_funds ?? null` entry. This is harmless but should be cleaned up.

**Fix**: Remove the duplicate line 88 in `supabase/functions/kyc-save/index.ts`.

### 2. Blank screen
The `App.tsx` provider hierarchy is correct — `ActiveWalletProvider` wraps all routes. The `ActiveWalletContext.tsx` file looks structurally sound. The blank screen is most likely caused by:
- A stale HMR bundle from the previous multi-file edit (network type expansion across 10+ files)
- The error may have been cached from the earlier session

**Fix**: Force a clean rebuild by adding a trivial comment or whitespace change to `src/main.tsx` to bust the HMR cache. If the error persists after that, we'll add defensive error boundaries.

### Changes

| File | Change |
|------|--------|
| `supabase/functions/kyc-save/index.ts` | Remove duplicate `source_of_funds` line |
| `src/main.tsx` | Trigger clean rebuild |

