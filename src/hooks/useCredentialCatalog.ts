import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

export interface CatalogEntry {
  credential_key: string
  credential_name: string
  description: string
  allowed_account_types: string[]
  requires_kyc: boolean
  requires_wallet: boolean
  is_active: boolean
  sort_order: number
  application_mode: string
  user_benefit: string | null
  user_cta: string | null
}

export function useCredentialCatalog() {
  const { user } = useAuth()
  const { profile } = useProfile()

  const { data: catalog = [], isLoading } = useQuery<CatalogEntry[]>({
    queryKey: ['credential-catalog'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('credential_catalog') as any)
        .select('credential_key, credential_name, description, allowed_account_types, requires_kyc, requires_wallet, is_active, sort_order, application_mode, user_benefit, user_cta')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })

  const accountType = (profile as any)?.account_type ?? 'individual'
  const eligibleCatalog = catalog.filter(
    (c) => c.allowed_account_types.includes(accountType) && c.application_mode === 'user_apply'
  )
  const autoIssuedCatalog = catalog.filter(
    (c) => c.allowed_account_types.includes(accountType) && c.application_mode === 'auto_issued'
  )

  return { catalog, eligibleCatalog, autoIssuedCatalog, isLoading, accountType }
}
