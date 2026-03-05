

## Fix Mint Token Flow — Polling Bugs

### Root Cause
The "Invalid transaction JSON" error from xaman-send-payment appears resolved (confirmed working via direct API test). However, **two critical bugs in MintWizard.tsx prevent the full mint flow from completing**:

### Bug 1: Parameter Key Mismatch (Polling Always Fails)
**File**: `src/components/mint/MintWizard.tsx` line 106

The wizard sends:
```js
body: { payload_uuid: uuid }
```
But `xaman-check-payload` expects:
```js
const { uuid } = await req.json()
```
`uuid` is always `undefined`, causing "UUID is required" error on every poll.

**Fix**: Change `payload_uuid` → `uuid` in the invoke call.

### Bug 2: Wrong Status Field Name
**File**: `src/components/mint/MintWizard.tsx` line 119

The wizard checks:
```js
checkData?.rejected
```
But `xaman-check-payload` returns:
```js
cancelled: xamanData.meta?.cancelled || false
```
Cancelled/rejected payloads are never detected, so polling continues until the 5-minute timeout.

**Fix**: Change `checkData?.rejected` → `checkData?.cancelled`.

### Changes

**`src/components/mint/MintWizard.tsx`** — Two line fixes:
- Line 106: `{ payload_uuid: uuid }` → `{ uuid }`
- Line 119: `checkData?.rejected` → `checkData?.cancelled`
- Line 122: Update error message for cancelled state

### Files to modify
- `src/components/mint/MintWizard.tsx` (2 line changes)

