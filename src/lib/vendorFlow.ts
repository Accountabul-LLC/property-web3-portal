export const VENDOR_CREDENTIAL_KEY = 'vendor'

export const VENDOR_ENTRY_ROUTE = '/vendors'
export const VENDOR_ONBOARDING_ROUTE = '/vendor/onboarding'
export const VENDOR_DASHBOARD_ROUTE = '/vendor/dashboard'
// Legacy alias kept so callers that referenced a separate status page resolve to the dashboard.
export const VENDOR_STATUS_ROUTE = VENDOR_DASHBOARD_ROUTE

export type VendorApplicationStatus =
  | 'none'
  | 'draft'
  | 'applied'
  | 'under_review'
  | 'approved'
  | 'issued_pending_acceptance'
  | 'active'
  | 'rejected'
  | 'expired'
  | 'revoked'
  | 'unknown'

export function normalizeVendorStatus(status?: string | null): VendorApplicationStatus {
  if (!status) return 'none'

  switch (status) {
    case 'draft':
    case 'applied':
    case 'under_review':
    case 'approved':
    case 'issued_pending_acceptance'  :
    case 'active':
    case 'rejected':
    case 'expired':
    case 'revoked':
      return status
    default:
      return 'unknown'
  }
}

export function getVendorNextRoute(status: VendorApplicationStatus): string {
  switch (status) {
    case 'active':
    case 'applied':
    case 'under_review':
    case 'approved':
    case 'issued_pending_acceptance':
    case 'rejected':
    case 'expired':
    case 'revoked':
    case 'draft':
      return VENDOR_DASHBOARD_ROUTE
    default:
      return VENDOR_ONBOARDING_ROUTE
  }
}

export function getVendorStatusTone(status: VendorApplicationStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default'
    case 'approved':
    case 'under_review':
    case 'applied':
    case 'issued_pending_acceptance':
    case 'draft':
      return 'secondary'
    case 'rejected':
    case 'expired':
    case 'revoked':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function getVendorStatusLabel(status: VendorApplicationStatus): string {
  switch (status) {
    case 'none':
      return 'Not Started'
    case 'draft':
      return 'Draft'
    case 'applied':
      return 'Submitted'
    case 'under_review':
      return 'Under Review'
    case 'approved':
      return 'Approved'
    case 'issued_pending_acceptance':
      return 'Pending Acceptance'
    case 'active':
      return 'Verified'
    case 'rejected':
      return 'Rejected'
    case 'expired':
      return 'Expired'
    case 'revoked':
      return 'Revoked'
    default:
      return 'Unknown'
  }
}

export function getVendorStatusCopy(status: VendorApplicationStatus): string {
  switch (status) {
    case 'active':
      return 'Your verified vendor credential is active and your dashboard is unlocked.'
    case 'approved':
      return 'Your application was approved and is waiting for credential issuance.'
    case 'issued_pending_acceptance':
      return 'Your credential is ready. Accept it to unlock vendor access.'
    case 'under_review':
    case 'applied':
      return 'We received your paid application. Manual review typically takes 24 to 48 hours.'
    case 'draft':
      return 'You have an in-progress vendor application.'
    case 'rejected':
      return 'Your application was not approved. Review the reason and reapply if needed.'
    case 'expired':
      return 'Your application expired. Submit a fresh application to re-enter review.'
    case 'revoked':
      return 'Your vendor credential was revoked. Contact support for next steps.'
    case 'none':
      return 'Start your verified vendor application when you are ready.'
    default:
      return 'Check your vendor application status.'
  }
}
