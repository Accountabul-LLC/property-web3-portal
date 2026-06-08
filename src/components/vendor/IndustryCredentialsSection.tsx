import { useMemo, useState } from 'react'
import { Loader2, Plus, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CredentialRow } from './CredentialRow'
import { useVendorCredentials } from '@/hooks/useVendorCredentials'
import {
  CREDENTIAL_CATALOG,
  INDUSTRIES,
} from '@/lib/vendorCredentialCatalog'

interface IndustryCredentialsSectionProps {
  vendorProfileId: string
  industry: string | null
}

export function IndustryCredentialsSection({
  vendorProfileId,
  industry,
}: IndustryCredentialsSectionProps) {
  const { credentials, isLoading } = useVendorCredentials(vendorProfileId)
  const [draftTypes, setDraftTypes] = useState<string[]>([])
  const [pickerValue, setPickerValue] = useState<string>('')

  const industryDef = useMemo(
    () => INDUSTRIES.find((i) => i.slug === industry) ?? null,
    [industry],
  )

  // Pre-suggested credential types for this industry that don't have a saved row yet
  const suggestedTypes = useMemo(() => {
    if (!industryDef) return []
    const saved = new Set(credentials.map((c) => c.credential_type))
    return industryDef.suggested.filter((t) => !saved.has(t))
  }, [industryDef, credentials])

  // Types already represented (saved or drafted) - filter from picker
  const usedDraftTypes = new Set(draftTypes)

  const pickableTypes = useMemo(() => {
    const taken = new Set<string>([
      ...credentials.map((c) => c.credential_type),
      ...suggestedTypes,
      ...draftTypes,
      'tax_exempt_ein',
      'ein', // handled in tax block on the profile form
    ])
    return Object.values(CREDENTIAL_CATALOG).filter((d) => !taken.has(d.type))
  }, [credentials, suggestedTypes, draftTypes])

  function addDraft(type: string) {
    if (!type || usedDraftTypes.has(type)) return
    setDraftTypes((prev) => [...prev, type])
    setPickerValue('')
  }

  function removeDraft(type: string) {
    setDraftTypes((prev) => prev.filter((t) => t !== type))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading credentials…
      </div>
    )
  }

  return (
    <div className="space-y-4 border-t border-border/60 pt-6">
      <div className="flex items-center gap-2">
        <Award className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Professional Credentials & Licenses</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Add any licenses, registrations, or certifications that prove you're a legitimate vendor. Upload supporting documents for faster verification.
      </p>

      {/* Suggested rows (no saved row yet) */}
      {suggestedTypes.map((type) => (
        <CredentialRow
          key={`suggested-${type}`}
          credentialType={type}
          vendorProfileId={vendorProfileId}
          suggested
        />
      ))}

      {/* Saved credentials */}
      {credentials
        .filter((c) => c.credential_type !== 'ein' && c.credential_type !== 'tax_exempt_ein')
        .map((c) => (
          <CredentialRow
            key={c.id}
            credentialType={c.credential_type}
            vendorProfileId={vendorProfileId}
            existing={c}
            suggested={industryDef?.suggested.includes(c.credential_type)}
          />
        ))}

      {/* Drafted (added via picker, not yet saved) */}
      {draftTypes.map((type) => (
        <CredentialRow
          key={`draft-${type}`}
          credentialType={type}
          vendorProfileId={vendorProfileId}
          onRemoveDraft={() => removeDraft(type)}
        />
      ))}

      {/* Add new credential picker */}
      <div className="flex flex-wrap items-end gap-2 pt-2">
        <div className="flex-1 min-w-[240px]">
          <Select
            value={pickerValue}
            onValueChange={(v) => addDraft(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Add another credential…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Available credentials</SelectLabel>
                {pickableTypes.map((d) => (
                  <SelectItem key={d.type} value={d.type}>{d.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" disabled className="hidden sm:inline-flex">
          <Plus className="w-4 h-4 mr-1" />
          Pick from list
        </Button>
      </div>
    </div>
  )
}
