import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { VendorLeadRecord } from '@/lib/vendorNetwork'

export function useVendorLeads(vendorProfileId: string | null | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: leads = [], isLoading, refetch } = useQuery<VendorLeadRecord[]>({
    queryKey: ['vendor-leads', user?.id, vendorProfileId],
    queryFn: async () => {
      if (!vendorProfileId) return []
      const { data, error } = await (supabase.from('vendor_leads') as any)
        .select('*')
        .eq('vendor_profile_id', vendorProfileId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as VendorLeadRecord[]
    },
    enabled: !!vendorProfileId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  async function updateLeadStatus(leadId: string, status: VendorLeadRecord['status']) {
    const { error } = await (supabase.from('vendor_leads') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', leadId)
    if (error) throw error
    qc.invalidateQueries({ queryKey: ['vendor-leads', user?.id, vendorProfileId] })
    return refetch()
  }

  return { leads, isLoading, refetch, updateLeadStatus }
}

