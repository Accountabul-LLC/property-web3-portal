import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface VendorCredential {
  id: string
  vendor_profile_id: string
  user_id: string
  credential_type: string
  credential_number: string
  issuing_state: string | null
  issuing_authority: string | null
  expires_on: string | null
  document_path: string | null
  document_name: string | null
  verification_status: 'unverified' | 'submitted' | 'verified' | 'rejected'
  notes: string | null
  created_at: string
  updated_at: string
}

export type VendorCredentialInput = Omit<
  VendorCredential,
  'id' | 'user_id' | 'verification_status' | 'created_at' | 'updated_at'
>

export function useVendorCredentials(vendorProfileId: string | null | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['vendor-credentials', user?.id, vendorProfileId]

  const query = useQuery<VendorCredential[]>({
    queryKey,
    queryFn: async () => {
      if (!user || !vendorProfileId) return []
      const { data, error } = await (supabase as any)
        .from('vendor_credentials')
        .select('*')
        .eq('vendor_profile_id', vendorProfileId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as VendorCredential[]
    },
    enabled: !!user && !!vendorProfileId,
    staleTime: 15_000,
  })

  const upsertMutation = useMutation({
    mutationFn: async (input: Partial<VendorCredential> & VendorCredentialInput) => {
      if (!user || !vendorProfileId) throw new Error('Not authenticated')
      const payload = {
        ...input,
        user_id: user.id,
        vendor_profile_id: vendorProfileId,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await (supabase as any)
        .from('vendor_credentials')
        .upsert(payload)
        .select()
        .single()
      if (error) throw error
      return data as VendorCredential
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (credential: VendorCredential) => {
      if (credential.document_path) {
        await supabase.storage.from('vendor-credentials').remove([credential.document_path])
      }
      const { error } = await (supabase as any)
        .from('vendor_credentials')
        .delete()
        .eq('id', credential.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  async function uploadDocument(credentialId: string, file: File): Promise<{ path: string; name: string }> {
    if (!user) throw new Error('Not authenticated')
    const ext = file.name.split('.').pop() || 'pdf'
    const path = `${user.id}/${credentialId}.${ext}`
    const { error } = await supabase.storage
      .from('vendor-credentials')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    return { path, name: file.name }
  }

  async function getSignedDocumentUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('vendor-credentials')
      .createSignedUrl(path, 60 * 10)
    if (error) return null
    return data.signedUrl
  }

  return {
    credentials: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    saveCredential: upsertMutation.mutateAsync,
    deleteCredential: deleteMutation.mutateAsync,
    uploadDocument,
    getSignedDocumentUrl,
  }
}
