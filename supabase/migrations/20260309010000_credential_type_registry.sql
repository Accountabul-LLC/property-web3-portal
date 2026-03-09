-- ============================================================
-- Credential Type Registry
--
-- Canonical source of truth for all 20 Accountabul credential
-- types as defined in the Credential Gating Architecture Plan
-- (Version 1.0, March 2026).
--
-- Each credential_type_hex is the UTF-8 hex encoding of the
-- human-readable label, conforming to XRPL CredentialType field
-- requirements.
--
-- Domains:
--   A — Identity & KYC
--   B — Compliance & Sanctions Clearance
--   C — Trading Access Tiers
--   D — Platform Membership & Operations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credential_type_registry (
  code                TEXT        PRIMARY KEY,
  credential_type_hex TEXT        NOT NULL UNIQUE,
  domain              TEXT        NOT NULL CHECK (domain IN ('identity_kyc', 'compliance_sanctions', 'trading_tiers', 'platform_membership')),
  label               TEXT        NOT NULL,
  description         TEXT        NOT NULL,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: all authenticated users can read; only admins can manage
ALTER TABLE public.credential_type_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_credential_types" ON public.credential_type_registry
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins_manage_credential_types" ON public.credential_type_registry
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Domain A — Identity & KYC ────────────────────────────────
INSERT INTO public.credential_type_registry (code, credential_type_hex, domain, label, description, sort_order) VALUES
  (
    'KYC_BASIC_US',
    '4B59435F42415349435F5553',
    'identity_kyc',
    'Basic US KYC',
    'Standard US identity verification passed. Required for all US-based retail trading. Confirms legal name, DOB, and address via government ID.',
    10
  ),
  (
    'KYC_ENHANCED_US',
    '4B59435F454E48414E4345445F5553',
    'identity_kyc',
    'Enhanced US KYC',
    'Full enhanced due diligence for US users. Required for higher transaction limits, margin accounts, and high-value trading tiers. Includes proof of income/wealth source.',
    20
  ),
  (
    'KYC_INTERNATIONAL',
    '4B59435F494E5445524E4154494F4E414C',
    'identity_kyc',
    'International KYC',
    'KYC passed for users outside the United States. Confirms jurisdiction eligibility and identity. Required for all non-US retail access.',
    30
  ),
  (
    'BUSINESS_ENTITY_VERIFIED',
    '425553494E4553535F454E544954595F5645524946494544',
    'identity_kyc',
    'Business Entity Verified',
    'Legal business entity (LLC, Corp, Partnership) has been verified. Required for institutional accounts, bulk vendor operations, and B2B marketplace participation.',
    40
  ),
  (
    'TAX_REPORTING_REGISTERED',
    '5441585F5245504F5254494E475F52454749535445524544',
    'identity_kyc',
    'Tax Reporting Registered',
    'User has submitted required tax documentation (W-9 for US residents, W-8BEN for foreign nationals). Required for any taxable trading activity on the platform.',
    50
  )
ON CONFLICT (code) DO NOTHING;

-- ── Domain B — Compliance & Sanctions Clearance ──────────────
INSERT INTO public.credential_type_registry (code, credential_type_hex, domain, label, description, sort_order) VALUES
  (
    'AML_CLEARED',
    '414D4C5F434C4541524544',
    'compliance_sanctions',
    'AML Cleared',
    'Anti-money laundering screening has passed. Validates that the wallet and associated identity are not flagged in AML databases. Required for all active trading accounts.',
    60
  ),
  (
    'OFAC_CLEARED',
    '4F4641435F434C4541524544',
    'compliance_sanctions',
    'OFAC Sanctions Cleared',
    'OFAC sanctions screening passed. The user and their associated entities are not on the SDN list. Required by US law for any US-facilitated transaction.',
    70
  ),
  (
    'ACCREDITED_INVESTOR_US',
    '414343524544495445445F494E564553544F525F5553',
    'compliance_sanctions',
    'Accredited Investor (US)',
    'User meets SEC criteria for accredited investor status (net worth >$1M or annual income >$200K). Unlocks access to private placements, unregistered securities, and institutional-grade investment instruments.',
    80
  ),
  (
    'RISK_DISCLOSURE_ACKNOWLEDGED',
    '5249534B5F444953434C4F535552455F41434B4E4F574C4544474544',
    'compliance_sanctions',
    'Risk Disclosure Acknowledged',
    'User has reviewed and acknowledged Accountabul risk disclosure document for volatile and speculative assets. Required before accessing high-risk markets, leveraged products, or illiquid instruments.',
    90
  ),
  (
    'CROSS_BORDER_APPROVED',
    '43524F53535F424F524445525F415050524F564544',
    'compliance_sanctions',
    'Cross-Border Approved',
    'User is cleared for cross-border (international) transactions. Satisfies additional jurisdiction checks required when assets flow between countries.',
    100
  )
ON CONFLICT (code) DO NOTHING;

-- ── Domain C — Trading Access Tiers ─────────────────────────
INSERT INTO public.credential_type_registry (code, credential_type_hex, domain, label, description, sort_order) VALUES
  (
    'RETAIL_TRADING_BASIC',
    '52455441494C5F54524144494E475F4241534943',
    'trading_tiers',
    'Retail Trading — Basic',
    'Entry-level credential for standard retail trading. Unlocks spot market access, standard order types, and basic portfolio tracking. Default credential issued after standard KYC approval.',
    110
  ),
  (
    'RETAIL_TRADING_ADVANCED',
    '52455441494C5F54524144494E475F414456414E434544',
    'trading_tiers',
    'Retail Trading — Advanced',
    'Expanded retail access including pro order types, real-time order book access, and elevated daily transaction limits. Requires KYC_ENHANCED_US or equivalent.',
    120
  ),
  (
    'DERIVATIVES_ELIGIBLE',
    '44455249564154495645535F454C494749424C45',
    'trading_tiers',
    'Derivatives Eligible',
    'Unlocks access to options, futures, and other derivative instruments. Requires ACCREDITED_INVESTOR_US and RISK_DISCLOSURE_ACKNOWLEDGED.',
    130
  ),
  (
    'MARKET_MAKER_APPROVED',
    '4D41524B45545F4D414B45525F415050524F564544',
    'trading_tiers',
    'Market Maker Approved',
    'Grants market maker status including access to market-making APIs, reduced fees, and two-sided quoting privileges. Requires institutional verification and a market-maker agreement.',
    140
  ),
  (
    'INSTITUTIONAL_TRADING',
    '494E535449545554494F4E414C5F54524144494E47',
    'trading_tiers',
    'Institutional Trading',
    'Full institutional access tier for hedge funds, family offices, broker-dealers, and other qualified entities. Unlocks bulk order routing, prime brokerage features, and highest transaction limits.',
    150
  ),
  (
    'HIGH_VALUE_TRADING_TIER',
    '484947485F56414C55455F54524144494E475F54494552',
    'trading_tiers',
    'High-Value Trading Tier',
    'Applied to individual or institutional accounts that meet volume or AUM thresholds. Unlocks priority execution, dedicated liquidity pools, and negotiated fee structures.',
    160
  ),
  (
    'VENDOR_MARKETPLACE_APPROVED',
    '56454E444F525F4D41524B4554504C4143455F415050524F564544',
    'trading_tiers',
    'Vendor Marketplace Approved',
    'Grants seller access to the Accountabul vendor marketplace. Required to list products, services, or tokenized assets for sale.',
    170
  )
ON CONFLICT (code) DO NOTHING;

-- ── Domain D — Platform Membership & Operations ──────────────
INSERT INTO public.credential_type_registry (code, credential_type_hex, domain, label, description, sort_order) VALUES
  (
    'PREMIUM_TIER_MEMBER',
    '5052454D49554D5F544945525F4D454D424552',
    'platform_membership',
    'Premium Tier Member',
    'Active premium or paid subscription member. Unlocks premium analytics dashboards, early feature access, reduced platform fees, and priority customer support.',
    180
  ),
  (
    'BETA_FEATURE_ACCESS',
    '424554415F464541545552455F414343455353',
    'platform_membership',
    'Beta Feature Access',
    'Grants access to pre-release and experimental platform features. Issued to selected testers, design partners, and early adopters.',
    190
  ),
  (
    'ADMIN_INTERNAL_CREDENTIAL',
    '41444D494E5F494E5445524E414C5F43524544454E5449414C',
    'platform_membership',
    'Admin / Internal Credential',
    'Internal-use credential issued to Accountabul team members for testing, support, and operational access. Never issued to external users. Revoked immediately upon offboarding.',
    200
  )
ON CONFLICT (code) DO NOTHING;

-- ── Feature Credential Requirements ─────────────────────────
-- Maps platform features to the credential codes required (ALL must be accepted).
-- Used by the credential gate checker.
CREATE TABLE IF NOT EXISTS public.feature_credential_requirements (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key  TEXT    NOT NULL,
  feature_label TEXT   NOT NULL,
  credential_codes TEXT[] NOT NULL,  -- codes from credential_type_registry
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feature_key)
);

ALTER TABLE public.feature_credential_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_feature_requirements" ON public.feature_credential_requirements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins_manage_feature_requirements" ON public.feature_credential_requirements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.feature_credential_requirements (feature_key, feature_label, credential_codes) VALUES
  (
    'SPOT_TRADING_US',
    'Standard Spot Trading (US)',
    ARRAY['KYC_BASIC_US', 'AML_CLEARED', 'OFAC_CLEARED', 'RETAIL_TRADING_BASIC', 'TAX_REPORTING_REGISTERED']
  ),
  (
    'SPOT_TRADING_ADVANCED_US',
    'Advanced Spot Trading (US)',
    ARRAY['KYC_ENHANCED_US', 'AML_CLEARED', 'OFAC_CLEARED', 'RETAIL_TRADING_ADVANCED', 'TAX_REPORTING_REGISTERED']
  ),
  (
    'DERIVATIVES_TRADING',
    'Derivatives / Options',
    ARRAY['KYC_ENHANCED_US', 'ACCREDITED_INVESTOR_US', 'AML_CLEARED', 'OFAC_CLEARED', 'DERIVATIVES_ELIGIBLE', 'RISK_DISCLOSURE_ACKNOWLEDGED']
  ),
  (
    'INTERNATIONAL_TRADING',
    'International Trading',
    ARRAY['KYC_INTERNATIONAL', 'AML_CLEARED', 'CROSS_BORDER_APPROVED', 'RETAIL_TRADING_BASIC']
  ),
  (
    'VENDOR_MARKETPLACE',
    'Vendor Marketplace (Selling)',
    ARRAY['AML_CLEARED', 'VENDOR_MARKETPLACE_APPROVED']
  ),
  (
    'INSTITUTIONAL_ACCOUNT',
    'Institutional Account',
    ARRAY['BUSINESS_ENTITY_VERIFIED', 'KYC_ENHANCED_US', 'AML_CLEARED', 'OFAC_CLEARED', 'INSTITUTIONAL_TRADING', 'TAX_REPORTING_REGISTERED']
  ),
  (
    'MARKET_MAKER',
    'Market Maker Program',
    ARRAY['INSTITUTIONAL_TRADING', 'MARKET_MAKER_APPROVED', 'OFAC_CLEARED', 'AML_CLEARED']
  ),
  (
    'PREMIUM_DASHBOARD',
    'Premium Analytics Dashboard',
    ARRAY['PREMIUM_TIER_MEMBER']
  ),
  (
    'BETA_FEATURES',
    'Beta Feature Access',
    ARRAY['BETA_FEATURE_ACCESS']
  )
ON CONFLICT (feature_key) DO NOTHING;

-- ── Backfill: map legacy ACCOUNTABUL_TRADE_APPROVED to new type ─
-- Existing permission_profiles use 'ACCOUNTABUL_TRADE_APPROVED'.
-- Add RETAIL_TRADING_BASIC as the canonical replacement going forward.
-- Legacy credential types are preserved for any existing on-ledger credentials.
UPDATE public.permission_profiles
SET credential_types = ARRAY['RETAIL_TRADING_BASIC']
WHERE code = 'TRADE_GLOBAL'
  AND credential_types = ARRAY['ACCOUNTABUL_TRADE_APPROVED'];

UPDATE public.permission_profiles
SET credential_types = ARRAY['RETAIL_TRADING_BASIC', 'PREMIUM_TIER_MEMBER']
WHERE code = 'PREMIUM_DEAL_ACCESS'
  AND credential_types = ARRAY['ACCOUNTABUL_TRADE_APPROVED', 'ACCOUNTABUL_PREMIUM_ACCESS'];

UPDATE public.permission_profiles
SET credential_types = ARRAY['RETAIL_TRADING_BASIC', 'ACCREDITED_INVESTOR_US']
WHERE code = 'ACCREDITED_INVESTOR'
  AND credential_types = ARRAY['ACCOUNTABUL_TRADE_APPROVED', 'ACCOUNTABUL_ACCREDITED'];
