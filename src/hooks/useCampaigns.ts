import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export type AcceptedAsset = 'XRP' | 'RLUSD'

export type Campaign = {
  id: string
  title: string
  slug: string
  description: string
  image_url: string | null
  gallery_urls: string[]
  video_url: string | null
  network: 'mainnet' | 'testnet'
  campaign_mode: 'scheduled' | 'evergreen'
  default_release_offset_days: number | null
  goal_amount: number | null
  currency: string
  accepted_assets: AcceptedAsset[]
  recipient_wallet_address: string
  release_date: string | null
  status: 'under_review' | 'approved' | 'active' | 'completed' | 'rejected'
  submitted_by_user_id: string | null
  submitted_by_email: string | null
  submission_notes: string | null
  total_raised: number
  donor_count: number
  created_at: string
  updated_at: string
}

export type MyDonation = {
  id: string
  amount: number
  currency: string
  escrow_status: 'pending' | 'escrowed' | 'released' | 'cancelled'
  donor_message: string | null
  donor_wallet_address: string
  created_at: string
  campaigns: Pick<Campaign, 'id' | 'title' | 'slug' | 'release_date' | 'campaign_mode' | 'network' | 'currency' | 'recipient_wallet_address'> | null
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          id, title, slug, description, image_url, gallery_urls, video_url,
          network, campaign_mode, default_release_offset_days,
          goal_amount, currency, accepted_assets,
          recipient_wallet_address, release_date, status, visibility,
          total_raised, donor_count, created_at, updated_at
        `)
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
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          id, title, slug, description, image_url, gallery_urls, video_url,
          network, campaign_mode, default_release_offset_days,
          goal_amount, currency, accepted_assets,
          recipient_wallet_address, release_date, status, visibility,
          total_raised, donor_count, created_at, updated_at
        `)
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
      const { data, error } = await supabase
        .rpc('get_public_campaign_donations', { p_campaign_id: campaignId })
      if (error) throw error
      return data
    },
    enabled: !!campaignId,
    staleTime: 15_000,
  })
}

export function useMyDonations(userId?: string) {
  return useQuery({
    queryKey: ['my-donations', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_donations')
        .select(`
          id, amount, currency, escrow_status, donor_message, donor_wallet_address, created_at,
          campaigns (id, title, slug, release_date, campaign_mode, network, currency, recipient_wallet_address)
        `)
        .eq('donor_user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as MyDonation[]
    },
    enabled: !!userId,
    staleTime: 15_000,
  })
}
