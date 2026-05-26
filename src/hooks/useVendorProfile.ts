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
  advertising_opt_in: boolean
  vendor_bio: string | null
  verification_status: 'not_requested' | 'requested' | 'under_review' | 'verified' | 'rejected' | 'revoked'
  verified_at: string | null
  requested_at: string | null
  reviewed_at: string | null
  notes: string | null
}

export type VendorProfileUpdate = Partial<Omit<VendorProfile, 'id' | 'user_id' | 'profile_id' | 'verified_at' | 'requested_at' | 'reviewed_at' | 'verification_status'>>

export function useVendorProfile(profileId: string | null | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: vendorProfile = null, isLoading, refetch } = useQuery<VendorProfile | null>({
    queryKey: ['vendor-profile', user?.id, profileId],
    queryFn: async () => {
      if (!user || !profileId) return null
      const { data, error } = await (supabase.from('vendor_profiles') as any)
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
      advertising_opt_in: updates.advertising_opt_in ?? false,
      vendor_bio: updates.vendor_bio ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await (supabase.from('vendor_profiles') as any)
      .upsert(payload, { onConflict: 'user_id' })

    if (error) throw error
    qc.invalidateQueries({ queryKey: ['vendor-profile', user.id, profileId] })
    return refetch()
  }

  return { vendorProfile, isLoading, refetch, saveVendorProfile }
}
