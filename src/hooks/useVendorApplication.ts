import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { useProfile } from '@/hooks/useProfile'
import { useCredentialApplications } from '@/hooks/useCredentialApplications'
import { useCredentialEligibility } from '@/hooks/useCredentialEligibility'
import { useVendorProfile } from '@/hooks/useVendorProfile'
import {
  VENDOR_CREDENTIAL_KEY,
  VENDOR_ONBOARDING_ROUTE,
  VENDOR_DASHBOARD_ROUTE,
  VENDOR_STATUS_ROUTE,
  getVendorNextRoute,
  getVendorStatusCopy,
  normalizeVendorStatus,
  type VendorApplicationStatus,
} from '@/lib/vendorFlow'

export function useVendorApplication() {
  const { user, loading: authLoading } = useAuth()
  const { activeAddress, walletsLoading } = useActiveWallet()
  const { profile, loading: profileLoading } = useProfile()
  const { applications, isLoading: appsLoading, applyForCredential } = useCredentialApplications()
  const { results, isLoading: eligibilityLoading } = useCredentialEligibility(activeAddress ?? null)
  const { vendorProfile } = useVendorProfile(profile?.id ?? null)

  const vendorApplication = useMemo(
    () => applications.find((app) => app.credential_key === VENDOR_CREDENTIAL_KEY) ?? null,
    [applications],
  )

  const vendorEligibility = useMemo(
    () => results.find((result) => result.credential_key === VENDOR_CREDENTIAL_KEY) ?? null,
    [results],
  )

  const vendorProfileStatus = useMemo<VendorApplicationStatus | null>(() => {
    if (!vendorProfile) return null
    switch (vendorProfile.verification_status) {
      case 'verified':
        return 'active'
      case 'approved':
        return 'approved'
      case 'requested':
      case 'under_review':
      case 'more_info_needed':
        return 'under_review'
      case 'denied':
        return 'rejected'
      case 'suspended':
        return 'revoked'
      case 'not_requested':
      default:
        return null
    }
  }, [vendorProfile])

  const status: VendorApplicationStatus = vendorProfileStatus ?? normalizeVendorStatus(vendorApplication?.status)
  const nextRoute = getVendorNextRoute(status)
  const isVerified = status === 'active'
  const isPendingReview = ['draft', 'applied', 'under_review', 'approved', 'issued_pending_acceptance'].includes(status)

  const canApply = !!user && !!activeAddress && (profile?.account_type ?? 'individual') === 'business' && !isVerified && !isPendingReview

  async function submitVendorApplication() {
    if (!activeAddress) {
      throw new Error('Connect a wallet first.')
    }
    return applyForCredential(VENDOR_CREDENTIAL_KEY, activeAddress)
  }

  return {
    user,
    activeAddress,
    profile,
    vendorApplication,
    vendorEligibility,
    vendorProfile,
    vendorProfileStatus,
    status,
    statusLabel: getVendorStatusCopy(status),
    nextRoute,
    isVerified,
    isPendingReview,
    canApply,
    submitVendorApplication,
    isLoading: authLoading || walletsLoading || profileLoading || appsLoading || eligibilityLoading,
    onboardingRoute: VENDOR_ONBOARDING_ROUTE,
    dashboardRoute: VENDOR_DASHBOARD_ROUTE,
    statusRoute: VENDOR_STATUS_ROUTE,
  }
}
