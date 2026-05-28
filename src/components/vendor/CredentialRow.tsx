import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Loader2, Trash2, Upload, FileCheck2, ExternalLink, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  CREDENTIAL_CATALOG,
  US_STATES,
  type CredentialDef,
} from '@/lib/vendorCredentialCatalog'
import {
  useVendorCredentials,
  type VendorCredential,
} from '@/hooks/useVendorCredentials'

interface CredentialRowProps {
  credentialType: string
  vendorProfileId: string
  existing?: VendorCredential
  /** Show a "suggested" badge in the header */
  suggested?: boolean
  onRemoveDraft?: () => void
}

export function CredentialRow({
  credentialType,
  vendorProfileId,
  existing,
  suggested,
  onRemoveDraft,
}: CredentialRowProps) {
  const def: CredentialDef =
    CREDENTIAL_CATALOG[credentialType] ?? CREDENTIAL_CATALOG.other

  const { saveCredential, deleteCredential, uploadDocument, getSignedDocumentUrl } =
    useVendorCredentials(vendorProfileId)

  const [credentialNumber, setCredentialNumber] = useState(existing?.credential_number ?? '')
  const [issuingState, setIssuingState] = useState(existing?.issuing_state ?? '')
  const [issuingAuthority, setIssuingAuthority] = useState(existing?.issuing_authority ?? '')
  const [expiresOn, setExpiresOn] = useState(existing?.expires_on ?? '')
  const [docPath, setDocPath] = useState<string | null>(existing?.document_path ?? null)
  const [docName, setDocName] = useState<string | null>(existing?.document_name ?? null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (existing) {
      setCredentialNumber(existing.credential_number)
      setIssuingState(existing.issuing_state ?? '')
      setIssuingAuthority(existing.issuing_authority ?? '')
      setExpiresOn(existing.expires_on ?? '')
      setDocPath(existing.document_path)
      setDocName(existing.document_name)
    }
  }, [existing])

  function validate(): string | null {
    if (!credentialNumber.trim() || credentialNumber.trim().length < 3) {
      return 'Credential number is required'
    }
    if (def.requiresState && !issuingState) {
      return `Issuing state is required for ${def.label}`
    }
    if (def.type === 'other' && !issuingAuthority.trim()) {
      return 'Issuing authority is required for "Other" credentials'
    }
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    setBusy(true)
    try {
      await saveCredential({
        id: existing?.id,
        vendor_profile_id: vendorProfileId,
        credential_type: def.type,
        credential_number: credentialNumber.trim(),
        issuing_state: issuingState || null,
        issuing_authority: issuingAuthority.trim() || null,
        expires_on: expiresOn || null,
        document_path: docPath,
        document_name: docName,
      } as any)
      toast.success('Credential saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save credential')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!existing) {
      onRemoveDraft?.()
      return
    }
    setBusy(true)
    try {
      await deleteCredential(existing)
      toast.success('Credential removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB')
      return
    }
    setUploading(true)
    try {
      // Save first to get an id if this is a brand new credential
      let credentialId = existing?.id
      if (!credentialId) {
        const err = validate()
        if (err) {
          toast.error(`Save the credential first: ${err}`)
          return
        }
        const saved = await saveCredential({
          vendor_profile_id: vendorProfileId,
          credential_type: def.type,
          credential_number: credentialNumber.trim(),
          issuing_state: issuingState || null,
          issuing_authority: issuingAuthority.trim() || null,
          expires_on: expiresOn || null,
          document_path: null,
          document_name: null,
        } as any)
        credentialId = saved.id
      }
      const { path, name } = await uploadDocument(credentialId!, file)
      await saveCredential({
        id: credentialId,
        vendor_profile_id: vendorProfileId,
        credential_type: def.type,
        credential_number: credentialNumber.trim(),
        issuing_state: issuingState || null,
        issuing_authority: issuingAuthority.trim() || null,
        expires_on: expiresOn || null,
        document_path: path,
        document_name: name,
      } as any)
      setDocPath(path)
      setDocName(name)
      toast.success('Document uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleViewDoc() {
    if (!docPath) return
    const url = await getSignedDocumentUrl(docPath)
    if (url) window.open(url, '_blank', 'noopener')
    else toast.error('Could not generate document link')
  }

  const statusBadge = (() => {
    const s = existing?.verification_status ?? 'unverified'
    if (s === 'verified')
      return <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-500/40"><ShieldCheck className="w-3 h-3 mr-1" />Verified</Badge>
    if (s === 'rejected')
      return <Badge variant="destructive">Rejected</Badge>
    if (s === 'submitted')
      return <Badge variant="secondary">Submitted</Badge>
    return <Badge variant="outline">Unverified</Badge>
  })()

  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="font-medium text-sm">{def.label}</h4>
        {suggested && <Badge variant="secondary" className="text-xs">Suggested for your industry</Badge>}
        {existing && statusBadge}
        {def.verifyUrl && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={def.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Public lookup
                </a>
              </TooltipTrigger>
              <TooltipContent>Open the official verification page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs">Credential Number</Label>
          <Input
            value={credentialNumber}
            onChange={(e) => setCredentialNumber(e.target.value)}
            placeholder={def.placeholder ?? 'Enter number'}
            className="mt-1"
          />
          {def.hint && <p className="text-xs text-muted-foreground mt-1">{def.hint}</p>}
        </div>

        {def.requiresState && (
          <div>
            <Label className="text-xs">Issuing State</Label>
            <Select value={issuingState} onValueChange={setIssuingState}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {def.requiresExpiration && (
          <div>
            <Label className="text-xs">Expiration Date</Label>
            <Input
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
              className="mt-1"
            />
          </div>
        )}

        {def.type === 'other' && (
          <div className="md:col-span-2">
            <Label className="text-xs">Issuing Authority</Label>
            <Input
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
              placeholder="e.g., NCQA, ICC, your state board"
              className="mt-1"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.currentTarget.value = ''
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
            {docPath ? 'Replace document' : 'Upload document'}
          </Button>
          {docPath && (
            <button
              type="button"
              onClick={handleViewDoc}
              className="text-xs text-primary hover:underline inline-flex items-center"
            >
              <FileCheck2 className="w-3 h-3 mr-1" />
              {docName ?? 'View uploaded document'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={busy}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Remove
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={busy}>
            {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            {existing ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
