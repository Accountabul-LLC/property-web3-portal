import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface CredentialApplication {
  id: string
  credential_key: string
  status: string
  wallet_address: string
  applied_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  issued_at: string | null
  expires_at: string | null
  accepted_at: string | null
  revoked_at: string | null
  notes: string | null
  wallet_credential_id: string | null
  credential_catalog: {
    credential_name: string
    description: string
    allowed_account_types: string[]
  } | null
}

export function useCredentialApplications() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: applications = [], isLoading, refetch } = useQuery<CredentialApplication[]>({
    queryKey: ['credential-applications', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await (supabase.from('credential_applications') as any)
        .select(`
          id, credential_key, status, wallet_address, applied_at, reviewed_at,
          rejection_reason, issued_at, expires_at, accepted_at, revoked_at, notes, wallet_credential_id,
          credential_catalog ( credential_name, description, allowed_account_types )
        `)
        .eq('user_id', user.id)
        .order('applied_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  async function applyForCredential(credential_key: string, wallet_address: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-for-credential`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ credential_key, wallet_address }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || res.statusText)
    qc.invalidateQueries({ queryKey: ['credential-applications', user?.id] })
    return json
  }

  return { applications, isLoading, refetch, applyForCredential }
}
