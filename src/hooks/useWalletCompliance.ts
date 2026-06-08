import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface WalletComplianceState {
  wallet_address: string
  is_trade_enabled: boolean
  kyc_status: string
  wallet_status: string
  registration_status: string
  registration_id?: string
  credential_status: string
  credential_id?: string
  permission_profiles: string[]
}

export function useWalletCompliance(walletAddress: string | null | undefined) {
  return useQuery<WalletComplianceState | null>({
    queryKey: ['wallet_compliance', walletAddress],
    enabled: !!walletAddress,
    // Refresh every 30 seconds so status changes propagate without full reload
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!walletAddress) return null

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return null

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compliance-check`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ wallet_address: walletAddress }),
        }
      )

      if (res.status === 401 || res.status === 403) {
        // Session expired or revoked on the server - clear locally and bounce to /auth
        await supabase.auth.signOut({ scope: 'local' })
        if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
          window.location.assign('/auth')
        }
        return null
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || 'compliance-check failed')
      }

      return res.json() as Promise<WalletComplianceState>
    },
  })
}

/** Convenience: resolves the human-readable label for the current compliance step */
export function complianceStepLabel(state: WalletComplianceState | null | undefined): string {
  if (!state) return 'Connect a wallet'
  if (state.kyc_status !== 'approved') return 'Complete identity verification'
  if (state.wallet_status !== 'active') return 'Wallet inactive or revoked'
  if (state.registration_status === 'not_started') return 'Request trade registration'
  if (state.registration_status === 'pending') return 'Registration pending review'
  if (state.registration_status === 'under_review') return 'Registration under compliance review'
  if (state.registration_status === 'rejected') return 'Registration rejected - re-apply'
  if (state.registration_status === 'revoked') return 'Registration revoked'
  if (state.credential_status === 'pending_issuance') return 'Credential issuance in progress'
  if (state.credential_status === 'issued') return 'Accept your trading credential'
  if (state.credential_status === 'accepted' && state.is_trade_enabled) return 'Trade-enabled'
  return 'Compliance incomplete'
}
