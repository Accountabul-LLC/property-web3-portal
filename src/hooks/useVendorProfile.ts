import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { buildVendorSlug, slugifyVendorName, type VendorProfileRecord } from '@/lib/vendorNetwork'

export interface VendorProfileUpdate {
  company_name: string
  slug?: string | null
  logo_url?: string | null
  profile_headline?: string | null
  business_email?: string | null
  business_phone?: string | null
  website_url?: string | null
  industry_category?: string | null
  business_description?: string | null
  service_areas?: string | null
  place_of_business?: string | null
  business_address_city?: string | null
  business_address_state?: string | null
  business_address_zip?: string | null
  years_in_business?: number | null
  year_founded?: number | null
  employee_count?: number | null
  ein_last4?: string | null
  tax_exempt_number?: string | null
  applicant_title?: string | null
  advertising_opt_in?: boolean
  public_profile_visible?: boolean
}

export function useVendorProfile(profileId: string | null | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: vendorProfile = null, isLoading, refetch } = useQuery<VendorProfileRecord | null>({
    queryKey: ['vendor-profile', user?.id, profileId],
    queryFn: async () => {
      if (!user || !profileId) return null
      const { data, error } = await (supabase.from('vendor_profiles') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('profile_id', profileId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const row: any = data
      return {
        ...row,
        industry_category: row.industry ?? null,
        business_description: row.vendor_bio ?? null,
        public_profile_visible: row.public_profile_enabled ?? false,
      } as VendorProfileRecord
    },
    enabled: !!user && !!profileId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  async function saveVendorProfile(updates: VendorProfileUpdate) {
    if (!user || !profileId) throw new Error('Not authenticated')
    const currentSlug = vendorProfile?.slug ?? null
    let slug = updates.slug ?? currentSlug
    if (!slug) {
      const base = slugifyVendorName(updates.company_name)
      const { data: exactMatch } = await (supabase.from('vendor_profiles') as any)
        .select('id, user_id, slug')
        .eq('slug', base)
        .maybeSingle()
      if (exactMatch && exactMatch.user_id !== user.id) {
        slug = await buildVendorSlug(updates.company_name, 1, user.id)
      } else {
        slug = base
      }
    }

    const payload = {
      user_id: user.id,
      profile_id: profileId,
      slug,
      company_name: updates.company_name,
      logo_url: updates.logo_url ?? null,
      profile_headline: updates.profile_headline ?? null,
      business_email: updates.business_email ?? null,
      business_phone: updates.business_phone ?? null,
      website_url: updates.website_url ?? null,
      industry: updates.industry_category ?? null,
      vendor_bio: updates.business_description ?? null,
      service_areas: updates.service_areas ?? null,
      place_of_business: updates.place_of_business ?? null,
      business_address_city: updates.business_address_city ?? null,
      business_address_state: updates.business_address_state ?? null,
      business_address_zip: updates.business_address_zip ?? null,
      years_in_business: updates.years_in_business ?? null,
      year_founded: updates.year_founded ?? null,
      employee_count: updates.employee_count ?? null,
      ein_last4: updates.ein_last4 ?? null,
      tax_exempt_number: updates.tax_exempt_number ?? null,
      applicant_title: updates.applicant_title ?? null,
      advertising_opt_in: updates.advertising_opt_in ?? false,
      public_profile_enabled: updates.public_profile_visible ?? false,
      updated_at: new Date().toISOString(),
    }

    const { error } = await (supabase.from('vendor_profiles') as any).upsert(payload, { onConflict: 'user_id' })
    if (error) throw error

    qc.invalidateQueries({ queryKey: ['vendor-profile', user.id, profileId] })
    return refetch()
  }

  return { vendorProfile, isLoading, refetch, saveVendorProfile }
}
