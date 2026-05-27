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
  xrp_usd_rate: number | null
  xrp_usd_value: number | null
  xrp_usd_quoted_at: string | null
  xrp_usd_source: string | null
  campaigns: Pick<Campaign, 'id' | 'title' | 'slug' | 'release_date' | 'campaign_mode' | 'network' | 'currency' | 'recipient_wallet_address'> | null
}

type PriceHistoryResponse = {
  quotes?: Record<string, {
    price: number
    source: string
    quoted_at: string
    fetched_at: string
  }>
}

export function getDonationUsdValue(donation: MyDonation): number | null {
  if (donation.currency === 'RLUSD') {
    return Number.isFinite(Number(donation.amount)) ? Number(donation.amount) : null
  }

  if (Number.isFinite(Number(donation.xrp_usd_value)) && Number(donation.xrp_usd_value) > 0) {
    return Number(donation.xrp_usd_value)
  }

  if (Number.isFinite(Number(donation.xrp_usd_rate)) && Number(donation.xrp_usd_rate) > 0) {
    return Number(donation.amount) * Number(donation.xrp_usd_rate)
  }

  return null
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
      return data as unknown as Campaign[]
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
      return data as unknown as Campaign
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


      const rows = ((data ?? []) as any[]).map((d) => ({
        ...d,
        xrp_usd_rate: null,
        xrp_usd_value: null,
        xrp_usd_quoted_at: null,
        xrp_usd_source: null,
      })) as MyDonation[]

      const needsHistoricalQuote = rows
        .filter((donation) => donation.currency === 'XRP' && !getDonationUsdValue(donation))
        .map((donation) => Math.floor(new Date(donation.created_at).getTime() / 1000))

      if (needsHistoricalQuote.length === 0) {
        return rows
      }

      const timestamps = Array.from(new Set(needsHistoricalQuote))
      const { data: historyData, error: historyError } = await supabase.functions.invoke('xrp-price-history', {
        body: { timestamps },
      })

      if (historyError) {
        return rows
      }

      const quotes = (historyData as PriceHistoryResponse | null)?.quotes ?? {}

      return rows.map((donation) => {
        if (donation.currency !== 'XRP' || getDonationUsdValue(donation)) {
          return donation
        }

        const quote = quotes[String(Math.floor(new Date(donation.created_at).getTime() / 1000))]
        if (!quote) return donation

        const xrpUsdValue = Number(donation.amount) * quote.price
        return {
          ...donation,
          xrp_usd_rate: quote.price,
          xrp_usd_value: xrpUsdValue,
          xrp_usd_quoted_at: quote.quoted_at,
          xrp_usd_source: quote.source,
        }
      })
    },
    enabled: !!userId,
    staleTime: 15_000,
  })
}
