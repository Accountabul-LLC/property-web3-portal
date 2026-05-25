import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export type Campaign = {
  id: string
  title: string
  slug: string
  description: string
  image_url: string | null
  video_url: string | null
  goal_amount: number | null
  currency: string
  recipient_wallet_address: string
  release_date: string
  status: 'under_review' | 'approved' | 'active' | 'completed' | 'rejected'
  submitted_by_user_id: string | null
  submitted_by_email: string | null
  submission_notes: string | null
  total_raised: number
  donor_count: number
  created_at: string
  updated_at: string
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('campaigns')
        .select('*')
        .in('status', ['active', 'completed'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Campaign[]
    },
    staleTime: 30_000,
  })
}

export function useCampaign(slug: string) {
  return useQuery({
    queryKey: ['campaign', slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('campaigns')
        .select('*')
        .eq('slug', slug)
        .single()
      if (error) throw error
      return data as Campaign
    },
    enabled: !!slug,
    staleTime: 30_000,
  })
}

export function useCampaignDonations(campaignId: string) {
  return useQuery({
    queryKey: ['campaign-donations', campaignId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('campaign_donations')
        .select('id, donor_wallet_address, amount, currency, donor_message, is_anonymous, escrow_status, created_at')
        .eq('campaign_id', campaignId)
        .in('escrow_status', ['escrowed', 'released'])
        .eq('is_anonymous', false)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
    enabled: !!campaignId,
    staleTime: 15_000,
  })
}

export function useMyDonations() {
  return useQuery({
    queryKey: ['my-donations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('campaign_donations')
        .select(`
          id, amount, currency, escrow_status, donor_message, created_at,
          campaigns (id, title, slug, release_date)
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    staleTime: 15_000,
  })
}
