import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/hooks/useProfile';
import type { VendorProfile } from '@/hooks/useVendorProfile';
import { getVendorNextRoute, normalizeVendorStatus, VENDOR_DASHBOARD_ROUTE } from '@/lib/vendorFlow';

export type VendorCtaAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'upgrade-modal' }
  | { kind: 'already-verified'; to: string };

export interface VendorCtaResult {
  action: VendorCtaAction;
  label: string;
}

/**
 * Decide what should happen when a user clicks "Request Verified Vendor Status"
 * based on their session + profile + vendor state.
 *
 * Routing decisions delegate to getVendorNextRoute (vendorFlow.ts) so that
 * this function stays in sync with the canonical vendor routing logic.
 */
export function resolveVendorCta(
  user: User | null,
  profile: Profile | null,
  vendorProfile: VendorProfile | null,
): VendorCtaResult {
  // Not signed in -> vendor-specific signup
  if (!user) {
    return {
      action: { kind: 'navigate', to: '/auth/vendor' },
      label: 'Sign Up as Vendor',
    };
  }

  // Already a verified vendor — use vendorFlow routing
  if (vendorProfile?.verification_status === 'verified') {
    return {
      action: { kind: 'already-verified', to: VENDOR_DASHBOARD_ROUTE },
      label: 'View Vendor Dashboard',
    };
  }

  // Individual user -> needs to upgrade to business first
  if (profile?.account_type !== 'business') {
    return {
      action: { kind: 'upgrade-modal' },
      label: 'Request Verified Vendor Status',
    };
  }

  // Business user, not yet verified -> delegate to vendorFlow for routing
  const status = normalizeVendorStatus(vendorProfile?.verification_status ?? null);
  const nextRoute = getVendorNextRoute(status);
  return {
    action: { kind: 'navigate', to: nextRoute },
    label:
      vendorProfile?.verification_status === 'requested' ||
      vendorProfile?.verification_status === 'under_review'
        ? 'Continue Vendor Verification'
        : 'Request Verified Vendor Status',
  };
}
