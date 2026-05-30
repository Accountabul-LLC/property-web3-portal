import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface VendorLead {
  id: string
  vendor_profile_id: string
  requester_user_id: string | null
  requester_name: string
  requester_email: string
  requester_phone: string | null
  property_address: string | null
  service_needed: string | null
  message: string | null
  status: 'new' | 'contacted' | 'closed' | 'spam' | 'archived'
  source: string
  created_at: string
  updated_at: string
}

export function useVendorLeads(vendorProfileId: string | null | undefined) {
  const qc = useQueryClient()

  const { data: leads = [], isLoading } = useQuery<VendorLead[]>({
    queryKey: ['vendor-leads', vendorProfileId],
    queryFn: async () => {
      if (!vendorProfileId) return []
      const { data, error } = await (supabase as any)
        .from('vendor_leads')
        .select('*')
        .eq('vendor_profile_id', vendorProfileId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as VendorLead[]
    },
    enabled: !!vendorProfileId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: VendorLead['status'] }) => {
      const { error } = await (supabase as any)
        .from('vendor_leads')
        .update({ status })
        .eq('id', leadId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-leads', vendorProfileId] })
    },
  })

  const newCount = leads.filter((l) => l.status === 'new').length

  return { leads, isLoading, updateStatus, newCount }
}
