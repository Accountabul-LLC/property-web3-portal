import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/hooks/useProfile';
import type { VendorProfile } from '@/hooks/useVendorProfile';

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

  // Already a verified vendor
  if (vendorProfile?.verification_status === 'verified') {
    return {
      action: { kind: 'already-verified', to: '/dashboard' },
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

  // Business user, not yet verified -> onboarding
  return {
    action: { kind: 'navigate', to: '/vendor/onboarding' },
    label:
      vendorProfile?.verification_status === 'requested' ||
      vendorProfile?.verification_status === 'under_review'
        ? 'Continue Vendor Verification'
        : 'Request Verified Vendor Status',
  };
}
