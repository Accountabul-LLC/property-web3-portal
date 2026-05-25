import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { callEdgeFunction } from '@/lib/edgeFunction'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  applicationId: string
  credentialKey: string
  userId: string
}

interface EvidenceDocument {
  id: string
  doc_type: string
  file_name: string | null
  storage_path: string
  status: string
  uploaded_at: string | null
  metadata: Record<string, unknown> | null
}

interface EvidenceRequirement {
  requirement_key: string
  display_label: string
  artifact_type: string
  artifact_subtype: string | null
  documents: EvidenceDocument[]
}

function docStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'accepted') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'secondary'
}

export function CredentialEvidencePanel({ applicationId, credentialKey, userId }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<{ evidence: EvidenceRequirement[]; kyc_case_id: string | null }>({
    queryKey: ['credential-evidence', applicationId],
    queryFn: () =>
      callEdgeFunction('review-credential-application', {
        application_id: applicationId,
        action: 'get_evidence',
      }),
    enabled: !!applicationId,
    staleTime: 60_000,
  })

  async function handleDownload(doc: EvidenceDocument) {
    setDownloadingId(doc.id)
    try {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(doc.storage_path, 300)

      if (signedError || !signedData?.signedUrl) {
        throw new Error(signedError?.message ?? 'Failed to generate download URL')
      }

      window.open(signedData.signedUrl, '_blank')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive py-4">
        <AlertTriangle className="w-4 h-4" />
        Failed to load evidence: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    )
  }

  const evidence = data?.evidence ?? []

  if (evidence.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No manual document requirements for this credential type.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        KYC Case ID: {data?.kyc_case_id ?? 'None'}
      </p>

      {evidence.map((req) => (
        <Card key={req.requirement_key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              {req.display_label}
              {req.artifact_subtype && (
                <Badge variant="outline" className="text-xs font-mono">{req.artifact_subtype}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {req.documents.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                No document uploaded for this requirement.
              </div>
            ) : (
              <div className="space-y-2">
                {req.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 rounded-md border bg-muted/30 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {doc.file_name ?? doc.doc_type}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={docStatusVariant(doc.status)} className="text-xs">
                          {doc.status}
                        </Badge>
                        {doc.uploaded_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingId === doc.id}
                      onClick={() => handleDownload(doc)}
                      className="flex-shrink-0"
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default CredentialEvidencePanel
