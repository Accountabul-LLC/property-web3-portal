// Shared MPT valuation helpers.
// Issuers carry the USD value of their unissued supply (max - outstanding).
// Holders carry holding * implied price-per-token when issuance metadata is known.

import type { MPTIssuance, MPTHolding } from '@/hooks/useXRPLPortfolio';

export interface MptIssuanceValuation {
  issuance: MPTIssuance;
  pricePerTokenUsd: number | null; // value_usd / max_amount (scaled)
  issuerHeldUnits: number; // (max - outstanding) / 10^scale
  issuerHeldUsd: number | null;
}

export function valueMptIssuance(mpt: MPTIssuance): MptIssuanceValuation {
  const scale = mpt.asset_scale || 0;
  const max = mpt.max_amount ? Number(mpt.max_amount) : 0;
  const outstanding = mpt.outstanding_amount ? Number(mpt.outstanding_amount) : 0;
  const heldRaw = Math.max(0, max - outstanding);
  const issuerHeldUnits = heldRaw / Math.pow(10, scale);
  const maxUnits = max / Math.pow(10, scale);

  let pricePerTokenUsd: number | null = null;
  let issuerHeldUsd: number | null = null;
  if (mpt.value_usd && mpt.value_usd > 0 && maxUnits > 0) {
    pricePerTokenUsd = mpt.value_usd / maxUnits;
    issuerHeldUsd = pricePerTokenUsd * issuerHeldUnits;
  }
  return { issuance: mpt, pricePerTokenUsd, issuerHeldUnits, issuerHeldUsd };
}

export function sumMptIssuerUsd(issuances: MPTIssuance[] | undefined | null): number {
  if (!issuances) return 0;
  let total = 0;
  for (const m of issuances) {
    const v = valueMptIssuance(m);
    if (v.issuerHeldUsd) total += v.issuerHeldUsd;
  }
  return total;
}

// Value MPT holdings against any known issuance metadata (issuer == self issuance, etc.).
export function sumMptHoldingsUsd(
  holdings: MPTHolding[] | undefined | null,
  issuancesById: Map<string, MPTIssuance>,
): number {
  if (!holdings) return 0;
  let total = 0;
  for (const h of holdings) {
    if (!h.mpt_issuance_id) continue;
    const iss = issuancesById.get(h.mpt_issuance_id);
    if (!iss) continue;
    const v = valueMptIssuance(iss);
    if (!v.pricePerTokenUsd) continue;
    const units = Number(h.amount || 0) / Math.pow(10, iss.asset_scale || 0);
    total += units * v.pricePerTokenUsd;
  }
  return total;
}
