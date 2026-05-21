import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface WalletRegistration {
  id: string
  registration_status: string
  created_at: string
}

export interface UseWalletRegistrationResult {
  registration: WalletRegistration | null
  walletId: string | null
  registrationStatus: string | null
  isRegistered: boolean
  isPending: boolean
  isRevoked: boolean
  isLoading: boolean
  registerWallet: () => Promise<{ registration_id: string; registration_status: string }>
}

export function useWalletRegistration(walletAddress: string | null): UseWalletRegistrationResult {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['wallet-registration', walletAddress, user?.id],
    queryFn: async () => {
      if (!walletAddress || !user) return null

      // 1. Look up the wallet row
      const { data: wallet, error: walletErr } = await (supabase
        .from('user_wallets') as any)
        .select('id, wallet_address')
        .eq('wallet_address', walletAddress)
        .eq('user_id', user.id)
        .maybeSingle()
      if (walletErr) throw walletErr
      if (!wallet) return null

      // 2. Look up the latest registration for this wallet (no FK → no embed)
      const { data: reg, error: regErr } = await (supabase
        .from('wallet_registrations') as any)
        .select('id, registration_status, created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (regErr) throw regErr

      return { id: wallet.id, wallet_registrations: reg ? [reg] : [] }
    },
    enabled: !!walletAddress && !!user,
    staleTime: 30_000,
  })

  const walletId: string | null = data?.id ?? null
  const registration: WalletRegistration | null = data?.wallet_registrations?.[0] ?? null
  const registrationStatus: string | null = registration?.registration_status ?? null
  const isRegistered = registrationStatus === 'approved'
  const isPending = registrationStatus === 'pending' || registrationStatus === 'under_review'
  const isRevoked = registrationStatus === 'revoked' || registrationStatus === 'rejected'

  async function registerWallet() {
    if (!walletId) throw new Error('Wallet not found')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ wallet_id: walletId }),
      }
    )
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || res.statusText)

    qc.invalidateQueries({ queryKey: ['wallet-registration', walletAddress] })
    qc.invalidateQueries({ queryKey: ['wallet-history'] })
    return json
  }

  return {
    registration,
    walletId,
    registrationStatus,
    isRegistered,
    isPending,
    isRevoked,
    isLoading,
    registerWallet,
  }
}
