

## Fix: `kyc-start` edge function — column `rejected_at` does not exist

### Root Cause

The `kyc-start` edge function on line 44 selects `rejected_at` from `kyc_cases`, but that column doesn't exist in the database. This causes a 500 error, which results in the blank screen.

```
.select('id, status, submitted_at, approved_at, rejected_at')
```

### Fix

**Option A (preferred — code fix only):** Remove `submitted_at`, `approved_at`, and `rejected_at` from the select since they're not used in the response anyway. Change line 44 to:

```typescript
.select('id, status')
```

This is the simplest fix — the function only returns `id` and `status` to the frontend, so the extra columns are unnecessary.

**Option B (if those columns are needed later):** Add a migration to create the missing columns on `kyc_cases`. But since the function doesn't use them in its response, Option A is correct.

### File Changed

| File | Change |
|------|--------|
| `supabase/functions/kyc-start/index.ts` | Line 44: change `.select('id, status, submitted_at, approved_at, rejected_at')` to `.select('id, status')` |

