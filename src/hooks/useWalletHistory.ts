import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface WalletHistoryEntry {
  id: string
  wallet_address: string
  status: string
  label: string | null
  created_at: string
  registration_status: string | null
  registration_id: string | null
}

export function useWalletHistory() {
  const { user } = useAuth()

  const { data: history = [], isLoading, refetch } = useQuery<WalletHistoryEntry[]>({
    queryKey: ['wallet-history', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await (supabase
        .from('user_wallets') as any)
        .select('id, wallet_address, status, label, created_at, wallet_registrations(id, registration_status)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((w: any) => ({
        id: w.id,
        wallet_address: w.wallet_address,
        status: w.status,
        label: w.label ?? null,
        created_at: w.created_at,
        registration_status: w.wallet_registrations?.[0]?.registration_status ?? null,
        registration_id: w.wallet_registrations?.[0]?.id ?? null,
      }))
    },
    enabled: !!user,
    staleTime: 30_000,
  })

  return { history, isLoading, refetch }
}
