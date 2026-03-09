import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface GateResult {
  is_eligible: boolean
  blocking_reason: string | null
  next_action: string | null
  credential_key: string | null
  credential_name: string | null
  application_status: string | null
}

export function useFeatureGate(walletAddress: string | null, featureKeyOrCredentialKey: string | null) {
  return useQuery<GateResult | null>({
    queryKey: ['feature-gate', walletAddress, featureKeyOrCredentialKey],
    queryFn: async () => {
      if (!walletAddress || !featureKeyOrCredentialKey) return null
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const body: Record<string, string> = { wallet_address: walletAddress }
      body.credential_key = featureKeyOrCredentialKey

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-credential`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!walletAddress && !!featureKeyOrCredentialKey,
    staleTime: 60_000,
  })
}
