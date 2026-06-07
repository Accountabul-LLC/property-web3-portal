import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export type IntakeLeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'not_interested'
  | 'approved'
  | 'rejected'

export const INTAKE_LEAD_STATUSES: IntakeLeadStatus[] = [
  'new',
  'contacted',
  'interested',
  'not_interested',
  'approved',
  'rejected',
]

export const INTAKE_STATUS_LABELS: Record<IntakeLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  not_interested: 'Not Interested',
  approved: 'Approved',
  rejected: 'Rejected',
}

export interface VendorIntakeLead {
  id: string
  created_at: string
  updated_at: string
  status: IntakeLeadStatus
  requester_name: string | null
  requester_email: string | null
  requester_phone: string | null
  business_name: string | null
  city_service_area: string | null
  occupation: string | null
  licensed_status: string | null
  best_time_to_contact: string | null
  serves_real_estate: string | null
  service_needed: string | null
  service_description: string | null
  internal_notes: string | null
  follow_up_date: string | null
  assigned_admin_id: string | null
  source: string
}

export function useVendorIntakeLeads() {
  return useQuery({
    queryKey: ['admin-vendor-intake-leads'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('vendor_leads') as any)
        .select(
          'id, created_at, updated_at, status, requester_name, requester_email, requester_phone, business_name, city_service_area, occupation, licensed_status, best_time_to_contact, serves_real_estate, service_needed, service_description, internal_notes, follow_up_date, assigned_admin_id, source',
        )
        .eq('source', 'intake_join')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as VendorIntakeLead[]
    },
    staleTime: 15_000,
  })
}

export function useUpdateIntakeLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<VendorIntakeLead> }) => {
      const { error } = await (supabase.from('vendor_leads') as any).update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vendor-intake-leads'] })
    },
  })
}
