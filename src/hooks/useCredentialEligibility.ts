import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface RequirementResult {
  requirement_key: string
  artifact_type: string
  check_mode: 'auto' | 'manual'
  display_label: string
  display_hint: string | null
  met: boolean
  is_blocking: boolean
}

export interface CredentialEligibilityResult {
  credential_key: string
  credential_name: string
  credential_class: 'A' | 'B'
  ui_section: 'active' | 'ready_to_accept' | 'auto_issuable' | 'eligible_apply' | 'needs_more_info' | 'unavailable'
  all_auto_met: boolean
  has_manual_requirements: boolean
  all_blocking_met: boolean
  blocking_reasons: string[]
  requirements: RequirementResult[]
  existing_application?: {
    id: string
    status: string
    expires_at: string | null
    wallet_credential_id: string | null
  }
}

export interface CredentialSections {
  active: CredentialEligibilityResult[]
  ready_to_accept: CredentialEligibilityResult[]
  auto_issuable: CredentialEligibilityResult[]
  eligible_apply: CredentialEligibilityResult[]
  needs_more_info: CredentialEligibilityResult[]
  unavailable: CredentialEligibilityResult[]
}

async function callEdgeFn(fnName: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || res.statusText)
  return json
}

function groupBySections(results: CredentialEligibilityResult[]): CredentialSections {
  const sections: CredentialSections = {
    active: [], ready_to_accept: [], auto_issuable: [],
    eligible_apply: [], needs_more_info: [], unavailable: [],
  }
  for (const r of results) {
    sections[r.ui_section].push(r)
  }
  return sections
}

export function useCredentialEligibility(walletAddress: string | null) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery<{ results: CredentialEligibilityResult[]; sections: CredentialSections } | null>({
    queryKey: ['credential-eligibility', walletAddress, user?.id],
    queryFn: async () => {
      if (!walletAddress || !user) return null
      const response = await callEdgeFn('evaluate-credential-eligibility', { wallet_address: walletAddress })
      const results: CredentialEligibilityResult[] = response.results ?? []
      return { results, sections: groupBySections(results) }
    },
    enabled: !!walletAddress && !!user,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  async function triggerAutoIssue(credential_key: string) {
    if (!walletAddress) throw new Error('No wallet address')
    await callEdgeFn('auto-issue-credential', { credential_key, wallet_address: walletAddress })
    qc.invalidateQueries({ queryKey: ['credential-eligibility', walletAddress, user?.id] })
  }

  async function applyForCredential(credential_key: string) {
    if (!walletAddress) throw new Error('No wallet address')
    await callEdgeFn('apply-for-credential', { credential_key, wallet_address: walletAddress })
    qc.invalidateQueries({ queryKey: ['credential-eligibility', walletAddress, user?.id] })
  }

  async function acceptCredential(wallet_credential_id: string) {
    await callEdgeFn('credential-accept', { credential_id: wallet_credential_id })
    qc.invalidateQueries({ queryKey: ['credential-eligibility', walletAddress, user?.id] })
  }

  async function forceRefresh() {
    if (!walletAddress || !user) return
    await callEdgeFn('evaluate-credential-eligibility', { wallet_address: walletAddress, force_recompute: true })
    qc.invalidateQueries({ queryKey: ['credential-eligibility', walletAddress, user?.id] })
  }

  return {
    results: data?.results ?? [],
    sections: data?.sections ?? {
      active: [], ready_to_accept: [], auto_issuable: [],
      eligible_apply: [], needs_more_info: [], unavailable: [],
    },
    isLoading,
    refetch,
    forceRefresh,
    triggerAutoIssue,
    applyForCredential,
    acceptCredential,
  }
}
