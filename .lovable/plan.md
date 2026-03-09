

## Problem

The `/credentials` page currently displays credentials with internal/admin-oriented language (e.g., "Trade Approved", "AML Cleared"). Users don't understand **why** they should apply or **what access** each credential unlocks. Additionally, many credentials (like AML_CLEARED, OFAC_CLEARED, KYC_BASIC_US) are things the **issuer auto-grants** after KYC — they shouldn't appear as user-apply options.

## Plan

### 1. Split credentials into user-applicable vs. auto-issued

Not all 20+ credentials should be in "Available to Apply." Many are issued automatically by the platform after identity verification. We need a new column on `credential_catalog` to distinguish them.

**Database migration**: Add `application_mode` column to `credential_catalog`:
- `'user_apply'` — user sees it and clicks Apply
- `'auto_issued'` — platform issues automatically (hidden from apply list, shown only once active)

Update existing rows:
- **User-apply**: `ACCREDITED_INVESTOR_US`, `RETAIL_TRADING_ADVANCED`, `DERIVATIVES_ELIGIBLE`, `MARKET_MAKER_APPROVED`, `INSTITUTIONAL_TRADING`, `HIGH_VALUE_TRADING_TIER`, `VENDOR_MARKETPLACE_APPROVED`, `PREMIUM_TIER_MEMBER`, `BETA_FEATURE_ACCESS`, `PROPERTY_ISSUER`, `CROSS_BORDER_APPROVED`
- **Auto-issued**: `KYC_BASIC_US`, `KYC_ENHANCED_US`, `KYC_INTERNATIONAL`, `BUSINESS_ENTITY_VERIFIED`, `TAX_REPORTING_REGISTERED`, `AML_CLEARED`, `OFAC_CLEARED`, `RISK_DISCLOSURE_ACKNOWLEDGED`, `RETAIL_TRADING_BASIC`, `TRADE_APPROVED`, `ADMIN_INTERNAL_CREDENTIAL`

### 2. Add user-facing copy fields to credential_catalog

**Database migration**: Add two columns:
- `user_benefit` (text) — short sentence explaining what the user unlocks (e.g., "Access exclusive high-value property offerings above $1M")
- `user_cta` (text) — call-to-action text (e.g., "Apply if you meet SEC accredited investor requirements")

Update all `user_apply` rows with friendly copy.

### 3. Update the Credentials page UI

**`src/hooks/useCredentialCatalog.ts`**: Add the new fields to the query and filter `availableToApply` to only `application_mode = 'user_apply'`.

**`src/pages/Credentials.tsx`**:
- Redesign the "Available to Apply" cards to show:
  - Credential name (friendly)
  - `user_benefit` — what you unlock (with a small unlock icon)
  - `user_cta` — guidance on who should apply
  - The existing requirement badges (KYC, Wallet)
  - Apply button
- Group credentials by domain using section subheaders (Identity, Compliance, Trading, Platform)
- Add an "Auto-Issued Credentials" info section at the bottom explaining that some credentials are granted automatically after identity verification

### 4. Example copy for key credentials

| Credential | User Benefit | CTA |
|---|---|---|
| Accredited Investor (US) | Unlock access to exclusive high-value offerings and private placements | Apply if you meet SEC accredited investor requirements (income >$200K or net worth >$1M) |
| Retail Trading Advanced | Access limit orders, advanced analytics, and higher trading limits | Ready for more? Apply to upgrade your trading capabilities |
| Property Issuer | Tokenize and list your properties on the marketplace | Apply if you own commercial or residential property to tokenize |
| Premium Tier Member | Exclusive deals, priority support, and advanced analytics dashboard | Join our premium tier for the best platform experience |
| Derivatives Eligible | Trade options and derivatives on tokenized real estate | Apply if you have experience with derivatives trading |

### Files to modify
- **Database**: 1 migration adding `application_mode`, `user_benefit`, `user_cta` columns + updating all rows
- **`src/hooks/useCredentialCatalog.ts`**: Add new fields to query, filter by `application_mode`
- **`src/pages/Credentials.tsx`**: Redesign credential cards with benefit/CTA copy, add domain grouping, add auto-issued info section

