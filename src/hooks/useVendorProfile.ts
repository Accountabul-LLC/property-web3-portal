import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface VendorProfile {
  id: string
  user_id: string
  profile_id: string
  company_name: string
  logo_url: string | null
  business_email: string | null
  business_phone: string | null
  place_of_business: string | null
  employee_count: number | null
  ein_last4: string | null
  ein_full: string | null
  industry: string | null
  tax_exempt: boolean
  tax_exempt_ein: string | null
  advertising_opt_in: boolean
  vendor_bio: string | null
  verification_status: 'not_requested' | 'requested' | 'under_review' | 'verified' | 'rejected' | 'revoked'
  verified_at: string | null
  requested_at: string | null
  reviewed_at: string | null
  notes: string | null
  // v1 public profile fields
  slug: string | null
  public_profile_enabled: boolean
  profile_headline: string | null
  website_url: string | null
  business_address_city: string | null
  business_address_state: string | null
  business_address_zip: string | null
  years_in_business: number | null
  profile_completed_at: string | null
  verification_tier: 'unverified' | 'business_verified' | 'credential_verified' | 'platform_vouched'
}

export type VendorProfileUpdate = Partial<
  Omit<VendorProfile, 'id' | 'user_id' | 'profile_id' | 'verified_at' | 'requested_at' | 'reviewed_at' | 'verification_status' | 'verification_tier'>
>

/** Generate a URL-safe slug from a company name. */
export function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

export function useVendorProfile(profileId: string | null | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: vendorProfile = null, isLoading, refetch } = useQuery<VendorProfile | null>({
    queryKey: ['vendor-profile', user?.id, profileId],
    queryFn: async () => {
      if (!user || !profileId) return null
      const { data, error } = await (supabase as any)
        .from('vendor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('profile_id', profileId)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as VendorProfile | null
    },
    enabled: !!user && !!profileId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  async function saveVendorProfile(updates: VendorProfileUpdate & { company_name: string }) {
    if (!user || !profileId) throw new Error('Not authenticated')

    // Auto-generate slug on first save if not already set
    let slug = vendorProfile?.slug ?? null
    if (!slug && updates.company_name) {
      const base = generateSlug(updates.company_name)
      // Check for collision
      const { data: existing } = await (supabase as any)
        .from('vendor_profiles')
        .select('id')
        .eq('slug', base)
        .neq('user_id', user.id)
        .maybeSingle()
      if (existing) {
        // Append last 4 chars of user id to avoid collision
        slug = `${base}-${user.id.slice(-4)}`
      } else {
        slug = base
      }
    }

    const payload = {
      user_id: user.id,
      profile_id: profileId,
      company_name: updates.company_name,
      logo_url: updates.logo_url ?? null,
      business_email: updates.business_email ?? null,
      business_phone: updates.business_phone ?? null,
      place_of_business: updates.place_of_business ?? null,
      employee_count: updates.employee_count ?? null,
      ein_last4: updates.ein_last4 ?? null,
      ein_full: updates.ein_full ?? null,
      industry: updates.industry ?? null,
      tax_exempt: updates.tax_exempt ?? false,
      tax_exempt_ein: updates.tax_exempt_ein ?? null,
      advertising_opt_in: updates.advertising_opt_in ?? false,
      vendor_bio: updates.vendor_bio ?? null,
      slug,
      public_profile_enabled: updates.public_profile_enabled ?? vendorProfile?.public_profile_enabled ?? false,
      profile_headline: updates.profile_headline ?? null,
      website_url: updates.website_url ?? null,
      business_address_city: updates.business_address_city ?? null,
      business_address_state: updates.business_address_state ?? null,
      business_address_zip: updates.business_address_zip ?? null,
      years_in_business: updates.years_in_business ?? null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await (supabase as any)
      .from('vendor_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    qc.invalidateQueries({ queryKey: ['vendor-profile', user.id, profileId] })
    await refetch()
    return data as VendorProfile
  }

  return { vendorProfile, isLoading, refetch, saveVendorProfile }
}
