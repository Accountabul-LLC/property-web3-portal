

## Enhance MPT Form — Full XRPL Spec Coverage

### Problem
The current MPT form only has 2 flags (transferable, clawback) with **incorrect hex values** in the edge function, and is missing key fields like token name/metadata and transfer fee.

### What Changes

**1. MPTForm.tsx — Add fields and all 6 flags**

New fields to add:
- **Token Name** (text input) — used in MPTokenMetadata JSON
- **Token Description** (textarea) — used in MPTokenMetadata JSON  
- **Transfer Fee** (number, 0-50000, shown as 0.000%-50.000%) — maps to `TransferFee` field. Only enabled when "Can Transfer" flag is checked.

All 6 XRPL flags (currently only 2):
| Flag | Hex | Description |
|---|---|---|
| tfMPTCanLock | 0x02 | Can be locked individually/globally |
| tfMPTRequireAuth | 0x04 | Holders must be authorized |
| tfMPTCanEscrow | 0x08 | Holders can escrow balances |
| tfMPTCanTrade | 0x10 | Holders can trade on DEX |
| tfMPTCanTransfer | 0x20 | Transferable between non-issuer accounts |
| tfMPTCanClawback | 0x40 | Issuer can clawback |

Update `MPTParams` interface:
```typescript
export interface MPTParams {
  name: string;           // NEW
  description: string;    // NEW
  max_amount: string;
  asset_scale: number;
  transfer_fee: number;   // NEW (0-50000)
  flags: {
    can_lock: boolean;
    require_auth: boolean;
    can_escrow: boolean;
    can_trade: boolean;
    can_transfer: boolean;
    can_clawback: boolean;
  };
}
```

**2. Edge function `xrpl-build-mint` — Fix flag hex values and add new fields**

Current (wrong):
- transferable: 0x02 (should be 0x20)
- clawback: 0x04 (should be 0x40)

Updated to build all 6 flags correctly, plus:
- Build `MPTokenMetadata` as hex-encoded JSON from name/description
- Include `TransferFee` field (only if can_transfer is true)

**3. MintWizard.tsx — Update default state and review display**

- Update `defaultMPT` to include new fields
- Update review step to show name, description, transfer fee, and all 6 flags

### Files to modify
- `src/components/mint/MPTForm.tsx` — expanded form
- `src/components/mint/MintWizard.tsx` — updated defaults + review
- `supabase/functions/xrpl-build-mint/index.ts` — corrected flags + new fields

