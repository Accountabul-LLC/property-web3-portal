import type { CredentialEligibilityResult } from '@/hooks/useCredentialEligibility'

export const VERIFIED_VENDOR_CREDENTIAL_KEY = 'vendor'

export type VendorNetworkState =
  | 'not_started'
  | 'active'
  | 'ready_to_accept'
  | 'auto_issuable'
  | 'eligible_apply'
  | 'needs_more_info'
  | 'unavailable'

export interface VendorStatusConfig {
  badgeLabel: string
  badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive'
  title: string
  description: string
  ctaLabel: string | null
}

export function getVendorCredential(results: CredentialEligibilityResult[] | null | undefined) {
  return results?.find((result) => result.credential_key === VERIFIED_VENDOR_CREDENTIAL_KEY) ?? null
}

export function getVendorNetworkState(vendorCredential: CredentialEligibilityResult | null | undefined): VendorNetworkState {
  return (vendorCredential?.ui_section as VendorNetworkState | undefined) ?? 'not_started'
}

export function getVendorStatusConfig(state: VendorNetworkState): VendorStatusConfig {
  switch (state) {
    case 'active':
      return {
        badgeLabel: 'Verified Vendor',
        badgeVariant: 'default',
        title: 'Verified Vendor Network',
        description: 'Your business profile is approved and showing the verified vendor badge.',
        ctaLabel: null,
      }
    case 'ready_to_accept':
      return {
        badgeLabel: 'Badge Ready',
        badgeVariant: 'secondary',
        title: 'Verified Vendor Network',
        description: 'Your vendor credential is ready. Accept it in your wallet to activate the badge.',
        ctaLabel: 'Accept Badge',
      }
    case 'auto_issuable':
      return {
        badgeLabel: 'Ready Now',
        badgeVariant: 'secondary',
        title: 'Verified Vendor Network',
        description: 'You qualify now. Request the vendor credential to start the approval flow.',
        ctaLabel: 'Request Verification',
      }
    case 'eligible_apply':
      return {
        badgeLabel: 'Requestable',
        badgeVariant: 'outline',
        title: 'Verified Vendor Network',
        description: 'Your business profile is eligible. Submit the request and we will review it.',
        ctaLabel: 'Request Verification',
      }
    case 'needs_more_info':
      return {
        badgeLabel: 'More Info Needed',
        badgeVariant: 'secondary',
        title: 'Verified Vendor Network',
        description: 'Complete the remaining business and wallet requirements to unlock vendor verification.',
        ctaLabel: 'Review Requirements',
      }
    case 'unavailable':
      return {
        badgeLabel: 'Unavailable',
        badgeVariant: 'destructive',
        title: 'Verified Vendor Network',
        description: 'This profile is not currently eligible for vendor verification.',
        ctaLabel: null,
      }
    case 'not_started':
    default:
      return {
        badgeLabel: 'Join Network',
        badgeVariant: 'outline',
        title: 'Verified Vendor Network',
        description: 'Business profiles can join as vendors first, then request the verified badge for marketplace trust.',
        ctaLabel: 'Request Verification',
      }
  }
}
