export type VendorVerificationStatus =
  | 'not_requested'
  | 'requested'
  | 'under_review'
  | 'more_info_needed'
  | 'approved'
  | 'verified'
  | 'denied'
  | 'suspended'

export type VendorSubscriptionStatus = 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled'
export type VendorPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'waived'
export type VendorAdRequestStatus =
  | 'no_request'
  | 'requested'
  | 'pending_approval'
  | 'approved'
  | 'denied'
  | 'active'
  | 'completed'

export interface VendorProfileRecord {
  id: string
  user_id: string
  profile_id: string
  slug: string | null
  company_name: string
  logo_url: string | null
  profile_headline: string | null
  business_email: string | null
  business_phone: string | null
  website_url: string | null
  industry_category: string | null
  business_description: string | null
  service_areas: string | null
  place_of_business: string | null
  business_address_city: string | null
  business_address_state: string | null
  business_address_zip: string | null
  years_in_business: number | null
  year_founded: number | null
  employee_count: number | null
  ein_last4: string | null
  tax_exempt_number: string | null
  applicant_title: string | null
  advertising_opt_in: boolean
  public_profile_visible: boolean
  public_profile_enabled: boolean
  verification_tier: string
  subscription_status: VendorSubscriptionStatus
  payment_status: VendorPaymentStatus
  ad_request_status: VendorAdRequestStatus
  vendor_tier: string
  verification_status: VendorVerificationStatus
  verified_at: string | null
  requested_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  suspended_at: string | null
  suspended_by: string | null
  suspension_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VendorPublicProfileRecord {
  id: string
  slug: string
  company_name: string
  logo_url: string | null
  business_email: string | null
  business_phone: string | null
  website_url: string | null
  industry_category: string | null
  business_description: string | null
  service_areas: string | null
  business_address_city: string | null
  business_address_state: string | null
  business_address_zip: string | null
  years_in_business: number | null
  verification_tier: string
  profile_headline: string | null
  public_profile_enabled: boolean
  verification_status: VendorVerificationStatus
  created_at: string
}

export interface VendorProfileRow {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  company_name: string | null
  phone: string | null
  account_type: string | null
  avatar_url: string | null
}

export interface VendorApplicationRecord {
  id: string
  user_id: string
  wallet_address: string
  credential_key: string
  status: string
  applied_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  issued_at: string | null
  expires_at: string | null
  accepted_at: string | null
  revoked_at: string | null
  revocation_reason: string | null
  notes: string | null
  wallet_credential_id: string | null
}

export interface VendorKycCaseRecord {
  id: string
  user_id: string
  status: string
  submitted_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  reviewer_id: string | null
}

export interface VendorLeadRecord {
  id: string
  vendor_profile_id: string
  requester_user_id: string | null
  requester_name: string
  requester_email: string
  requester_phone: string | null
  service_needed: string
  message: string
  source: string
  status: 'new' | 'contacted' | 'closed'
  created_at: string
  updated_at: string
}

export function getVendorDisplayName(profile?: VendorProfileRow | null, vendor?: VendorProfileRecord | null) {
  return (
    vendor?.company_name ||
    profile?.company_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.full_name ||
    'Unknown'
  )
}

export function slugifyVendorName(companyName: string) {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function hashSuffix(input: string) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input))
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.slice(0, 2).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildVendorSlug(companyName: string, collisionCount = 0, seed = companyName) {
  const base = slugifyVendorName(companyName) || 'vendor'
  if (collisionCount <= 0) return base
  const suffix = await hashSuffix(`${seed}:${collisionCount}`)
  return `${base}-${suffix.slice(0, 4)}`
}

export function getVendorPublicUrl(slug: string) {
  return `/vendors/${slug}`
}

export function getVendorVerificationLabel(status?: VendorVerificationStatus | string | null) {
  switch (status) {
    case 'approved':
      return 'Approved'
    case 'verified':
      return 'Verified'
    case 'requested':
      return 'Requested'
    case 'under_review':
      return 'Under Review'
    case 'more_info_needed':
      return 'More Info Needed'
    case 'denied':
      return 'Denied'
    case 'suspended':
      return 'Suspended'
    default:
      return 'Not Requested'
  }
}

export function getVendorTierLabel(tier?: string | null) {
  switch (tier) {
    case 'business_verified':
      return 'Business Verified'
    case 'credential_verified':
      return 'Credential Verified'
    case 'platform_vouched':
      return 'Platform Vouched'
    case 'unverified':
    default:
      return 'Unverified'
  }
}

export function getVendorTone(status?: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
    case 'verified':
    case 'active':
      return 'default'
    case 'requested':
    case 'under_review':
    case 'more_info_needed':
    case 'pending':
    case 'pending_approval':
      return 'secondary'
    case 'denied':
    case 'rejected':
    case 'revoked':
    case 'suspended':
    case 'failed':
    case 'past_due':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function getKycLabel(status?: string | null) {
  switch (status) {
    case 'approved':
      return 'KYC/KYB Passed'
    case 'under_review':
      return 'KYC/KYB Under Review'
    case 'submitted':
      return 'KYC/KYB Pending'
    case 'rejected':
      return 'KYC/KYB Rejected'
    case 'expired':
      return 'KYC/KYB Expired'
    default:
      return 'KYC/KYB Not Started'
  }
}

export function isVendorProfileComplete(vendor?: VendorProfileRecord | null) {
  if (!vendor) return false
  const required = [
    vendor.company_name,
    vendor.business_email,
    vendor.business_phone,
    vendor.place_of_business,
    vendor.business_address_city,
    vendor.business_address_state,
    vendor.business_address_zip,
    vendor.years_in_business?.toString() ?? null,
    vendor.industry_category,
    vendor.business_description,
    vendor.applicant_title,
    vendor.ein_last4,
  ]
  return required.every((value) => typeof value === 'string' && value.trim().length > 0)
}

export function isVendorBadgeVisible(input: {
  applicationStatus?: string | null
  kycStatus?: string | null
  vendor?: VendorProfileRecord | null
}) {
  const vendor = input.vendor
  if (!vendor) return false

  const applicationApproved = ['approved', 'issued_pending_acceptance', 'active'].includes(input.applicationStatus ?? '')
  const kycPassed = input.kycStatus === 'approved'
  const subscriptionActive = vendor.subscription_status === 'active'
  const paymentGood = vendor.payment_status === 'paid' || vendor.payment_status === 'waived'
  const notSuspended = vendor.verification_status !== 'suspended'
  const profileComplete = isVendorProfileComplete(vendor)
  const verificationApproved = vendor.verification_status === 'verified'

  return applicationApproved && verificationApproved && kycPassed && subscriptionActive && paymentGood && notSuspended && profileComplete
}

export function isPublicVendorVisible(vendor?: VendorPublicProfileRecord | null) {
  return !!vendor && vendor.verification_status === 'verified' && vendor.public_profile_enabled
}
