

## Code Audit — Build Error Fixes

There are **5 distinct build errors** to resolve:

---

### 1. Duplicate `WalletHistoryPanel` import in `Dashboard.tsx`

**Lines 5 and 19** both import `WalletHistoryPanel`. Remove the duplicate on line 19.

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Delete line 19 (`import { WalletHistoryPanel } ...`) |

---

### 2. Missing `credential_applications` and `credential_catalog` tables in types

The auto-generated `types.ts` does not include `credential_applications` or `credential_catalog` tables, meaning these tables likely need to be created via a database migration (they exist in edge functions but aren't in the schema). The hooks already cast via `as any` to work around this, but the TS compiler still flags the type mismatch in strict mode.

**Root cause**: These tables were never created in the database. They need a migration.

| File | Change |
|------|--------|
| Migration | Create `credential_catalog` and `credential_applications` tables with appropriate columns and RLS policies |

**`credential_catalog`** columns (derived from hook usage): `credential_key` (PK text), `credential_name`, `description`, `allowed_account_types` (text[]), `requires_kyc` (bool), `requires_wallet` (bool), `is_active` (bool), `sort_order` (int), `maps_to_xrpl_code` (text).

**`credential_applications`** columns (derived from hook + edge function usage): `id` (uuid PK), `user_id` (uuid), `wallet_address` (text), `credential_key` (text FK), `status` (text), `applied_at`, `reviewed_at`, `rejection_reason`, `issued_at`, `expires_at`, `accepted_at`, `revoked_at`, `revocation_reason`, `notes`, `wallet_credential_id` (uuid FK to wallet_credentials).

RLS: Users read/insert own rows; admins read/update all.

After migration, the types will auto-regenerate and the TS errors will resolve.

---

### 3. `npm:xrpl@3.1.0` import fails in Deno edge functions

Four edge functions use `await import('npm:xrpl@3.1.0')` for `Wallet.fromSeed()`. Deno in the Lovable Cloud environment doesn't resolve bare `npm:` specifiers without a `deno.json` or `package.json`.

**Fix**: Replace `npm:xrpl@3.1.0` with the ESM CDN equivalent: `https://esm.sh/xrpl@3.1.0`. Only the `Wallet` class is used (for `fromSeed` + signing), so this is a drop-in replacement.

| File | Change |
|------|--------|
| `supabase/functions/credential-accept/index.ts` | `import('npm:xrpl@3.1.0')` → `import('https://esm.sh/xrpl@3.1.0')` |
| `supabase/functions/xrpl-submit-signed/index.ts` | Same replacement |
| `supabase/functions/issue-testnet-credential/index.ts` | Same replacement |
| `supabase/functions/revoke-credential/index.ts` | Same replacement |

---

### Summary of changes

1. **`src/pages/Dashboard.tsx`** — Remove duplicate import (line 19)
2. **Database migration** — Create `credential_catalog` and `credential_applications` tables with RLS
3. **4 edge functions** — Replace `npm:xrpl@3.1.0` with `https://esm.sh/xrpl@3.1.0`

