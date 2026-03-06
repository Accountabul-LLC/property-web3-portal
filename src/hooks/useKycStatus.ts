import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export type KycStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired'

export interface KycStatusResult {
  status: KycStatus
  kycCaseId: string | null
  rejectionReason: string | null
  isLoading: boolean
  isApproved: boolean
}

export function useKycStatus(): KycStatusResult {
  const { user, loading: authLoading } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['kyc-status', user?.id],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('id, status, rejection_reason')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!user && !authLoading,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      // Poll while under active review
      if (status === 'submitted' || status === 'under_review') return 30_000
      return false
    },
  })

  const status: KycStatus = data?.status ?? 'not_started'

  return {
    status,
    kycCaseId: data?.id ?? null,
    rejectionReason: data?.rejection_reason ?? null,
    isLoading: authLoading || isLoading,
    isApproved: status === 'approved',
  }
}
