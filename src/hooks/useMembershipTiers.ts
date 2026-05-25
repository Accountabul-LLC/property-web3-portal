import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export type MembershipTier = {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_annual: number | null
  description: string | null
  features: string[]
  highlight_feature: string | null
  is_popular: boolean
  is_active: boolean
  sort_order: number
  cta_label: string
  created_at: string
  updated_at: string
}

export function useMembershipTiers() {
  return useQuery({
    queryKey: ['membership-tiers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('membership_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data as MembershipTier[]
    },
    staleTime: 60_000,
  })
}

export function useAllMembershipTiers() {
  return useQuery({
    queryKey: ['membership-tiers-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('membership_tiers')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return data as MembershipTier[]
    },
    staleTime: 30_000,
  })
}

export function useMyMembership() {
  return useQuery({
    queryKey: ['my-membership'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('membership_tier_id, membership_tiers(*)')
        .eq('id', user.id)
        .single()
      if (error) throw error
      return (data?.membership_tiers ?? null) as MembershipTier | null
    },
    staleTime: 30_000,
  })
}

export function useSelectMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tierId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ membership_tier_id: tierId, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-membership'] })
    },
  })
}

export function useUpdateTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MembershipTier> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('membership_tiers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['membership-tiers'] })
      qc.invalidateQueries({ queryKey: ['membership-tiers-all'] })
    },
  })
}
