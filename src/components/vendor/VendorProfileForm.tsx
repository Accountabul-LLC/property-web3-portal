import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useVendorProfile } from '@/hooks/useVendorProfile'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload, Building2, Globe, MapPin, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { IndustryCredentialsSection } from './IndustryCredentialsSection'
import { INDUSTRIES, US_STATES, normalizeEin, einLast4 } from '@/lib/vendorCredentialCatalog'

interface VendorProfileFormProps {
  profileId: string | null | undefined
  companyName: string | null | undefined
  onSaved?: () => void
}

export function VendorProfileForm({ profileId, companyName, onSaved }: VendorProfileFormProps) {
  const { user } = useAuth()
  const { vendorProfile, isLoading, saveVendorProfile } = useVendorProfile(profileId)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [form, setForm] = useState({
    company_name: companyName ?? '',
    logo_url: '',
    business_email: '',
    business_phone: '',
    place_of_business: '',
    employee_count: '',
    industry: '',
    ein_full: '',
    tax_exempt: false,
    tax_exempt_ein: '',
    advertising_opt_in: false,
    vendor_bio: '',
    // v1 public profile fields
    profile_headline: '',
    website_url: '',
    business_address_city: '',
    business_address_state: '',
    business_address_zip: '',
    years_in_business: '',
  })

  useEffect(() => {
    setForm({
      company_name: vendorProfile?.company_name ?? companyName ?? '',
      logo_url: vendorProfile?.logo_url ?? '',
      business_email: vendorProfile?.business_email ?? '',
      business_phone: vendorProfile?.business_phone ?? '',
      place_of_business: vendorProfile?.place_of_business ?? '',
      employee_count: vendorProfile?.employee_count?.toString() ?? '',
      industry: vendorProfile?.industry ?? '',
      ein_full: vendorProfile?.ein_full ?? '',
      tax_exempt: vendorProfile?.tax_exempt ?? false,
      tax_exempt_ein: vendorProfile?.tax_exempt_ein ?? '',
      advertising_opt_in: vendorProfile?.advertising_opt_in ?? false,
      vendor_bio: vendorProfile?.vendor_bio ?? '',
      profile_headline: vendorProfile?.profile_headline ?? '',
      website_url: vendorProfile?.website_url ?? '',
      business_address_city: vendorProfile?.business_address_city ?? '',
      business_address_state: vendorProfile?.business_address_state ?? '',
      business_address_zip: vendorProfile?.business_address_zip ?? '',
      years_in_business: vendorProfile?.years_in_business?.toString() ?? '',
    })
  }, [vendorProfile, companyName])

  async function handleLogoUpload(file: File) {
    if (!user) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, WebP, or SVG logo')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be under 5MB')
      return
    }

    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${user.id}/vendor-logo.${ext}`
      const { error: uploadError } = await supabase.storage.from('token-logos').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('token-logos').getPublicUrl(path)
      setForm((prev) => ({ ...prev, logo_url: data.publicUrl }))
      toast.success('Logo uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Logo upload failed')
    } finally {
      setUploadingLogo(false)
    }
  }

  function formatEin(input: string): string {
    const digits = input.replace(/\D/g, '').slice(0, 9)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}-${digits.slice(2)}`
  }

  async function handleSave() {
    if (!form.company_name.trim()) {
      toast.error('Company name is required')
      return
    }

    let einNormalized: string | null = null
    if (form.ein_full.trim()) {
      einNormalized = normalizeEin(form.ein_full)
      if (!einNormalized) {
        toast.error('EIN must be 9 digits (XX-XXXXXXX)')
        return
      }
    }
    let taxExemptEinNormalized: string | null = null
    if (form.tax_exempt && form.tax_exempt_ein.trim()) {
      taxExemptEinNormalized = normalizeEin(form.tax_exempt_ein)
      if (!taxExemptEinNormalized) {
        toast.error('Tax-exempt EIN must be 9 digits (XX-XXXXXXX)')
        return
      }
    }

    setSaving(true)
    try {
      await saveVendorProfile({
        company_name: form.company_name.trim(),
        logo_url: form.logo_url.trim() || null,
        business_email: form.business_email.trim() || null,
        business_phone: form.business_phone.trim() || null,
        place_of_business: form.place_of_business.trim() || null,
        employee_count: form.employee_count ? Number(form.employee_count) : null,
        industry: form.industry || null,
        ein_full: einNormalized,
        ein_last4: einLast4(einNormalized),
        tax_exempt: form.tax_exempt,
        tax_exempt_ein: form.tax_exempt ? taxExemptEinNormalized : null,
        advertising_opt_in: form.advertising_opt_in,
        vendor_bio: form.vendor_bio.trim() || null,
        profile_headline: form.profile_headline.trim() || null,
        website_url: form.website_url.trim() || null,
        business_address_city: form.business_address_city.trim() || null,
        business_address_state: form.business_address_state || null,
        business_address_zip: form.business_address_zip.trim() || null,
        years_in_business: form.years_in_business ? Number(form.years_in_business) : null,
      })
      toast.success('Vendor profile saved')
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save vendor profile')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const publicUrl = vendorProfile?.slug
    ? `${window.location.origin}/vendor/${vendorProfile.slug}`
    : null

  return (
    <div className="space-y-6">
      {/* Public profile URL preview */}
      {publicUrl && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <Globe className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Your public profile URL</p>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline truncate flex items-center gap-1"
            >
              {publicUrl}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>
          {!vendorProfile?.public_profile_enabled && (
            <Badge variant="outline" className="flex-shrink-0 text-xs">Not live yet</Badge>
          )}
        </div>
      )}

      {/* Business identity */}
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Business Identity
          </h3>
          <p className="text-sm text-muted-foreground">Core information shown on your public profile.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Company Name <span className="text-destructive">*</span></Label>
            <Input
              value={form.company_name}
              onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
              placeholder="Acme Holdings LLC"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Industry <span className="text-destructive">*</span></Label>
            <Select value={form.industry} onValueChange={(v) => setForm((prev) => ({ ...prev, industry: v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i.slug} value={i.slug}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Profile Headline</Label>
            <Input
              value={form.profile_headline}
              onChange={(e) => setForm((prev) => ({ ...prev, profile_headline: e.target.value }))}
              placeholder="Licensed general contractor serving the greater St. Louis area"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">One line shown on your directory card and profile page.</p>
          </div>
          <div>
            <Label>Business Email</Label>
            <Input
              type="email"
              value={form.business_email}
              onChange={(e) => setForm((prev) => ({ ...prev, business_email: e.target.value }))}
              placeholder="hello@acme.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Business Phone</Label>
            <Input
              value={form.business_phone}
              onChange={(e) => setForm((prev) => ({ ...prev, business_phone: e.target.value }))}
              placeholder="(555) 123-4567"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Website</Label>
            <Input
              value={form.website_url}
              onChange={(e) => setForm((prev) => ({ ...prev, website_url: e.target.value }))}
              placeholder="https://acme.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Years in Business</Label>
            <Input
              type="number"
              min="0"
              max="200"
              value={form.years_in_business}
              onChange={(e) => setForm((prev) => ({ ...prev, years_in_business: e.target.value }))}
              placeholder="12"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Employee Count</Label>
            <Input
              type="number"
              min="0"
              value={form.employee_count}
              onChange={(e) => setForm((prev) => ({ ...prev, employee_count: e.target.value }))}
              placeholder="12"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Service area */}
      <div className="space-y-4 border-t border-border/60 pt-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Service Area
          </h3>
          <p className="text-sm text-muted-foreground">Where you operate. Used for directory filtering.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>City <span className="text-destructive">*</span></Label>
            <Input
              value={form.business_address_city}
              onChange={(e) => setForm((prev) => ({ ...prev, business_address_city: e.target.value }))}
              placeholder="St. Louis"
              className="mt-1"
            />
          </div>
          <div>
            <Label>State <span className="text-destructive">*</span></Label>
            <Select
              value={form.business_address_state}
              onValueChange={(v) => setForm((prev) => ({ ...prev, business_address_state: v }))}
            >
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
          <div>
            <Label>ZIP Code</Label>
            <Input
              value={form.business_address_zip}
              onChange={(e) => setForm((prev) => ({ ...prev, business_address_zip: e.target.value }))}
              placeholder="63101"
              maxLength={10}
              className="mt-1"
            />
          </div>
          <div className="md:col-span-3">
            <Label>Place of Business (legacy / freeform)</Label>
            <Input
              value={form.place_of_business}
              onChange={(e) => setForm((prev) => ({ ...prev, place_of_business: e.target.value }))}
              placeholder="e.g. Dallas, TX or remote"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Vendor bio */}
      <div className="space-y-2 border-t border-border/60 pt-6">
        <Label>Vendor Bio</Label>
        <Textarea
          value={form.vendor_bio}
          onChange={(e) => setForm((prev) => ({ ...prev, vendor_bio: e.target.value }))}
          placeholder="Describe your business, services, and what makes you different. Minimum 150 characters recommended."
          className="min-h-[100px]"
        />
        <p className="text-xs text-muted-foreground">
          {form.vendor_bio.length} characters
          {form.vendor_bio.length > 0 && form.vendor_bio.length < 150 && (
            <span className="text-amber-600"> — aim for at least 150</span>
          )}
        </p>
      </div>

      {/* Tax IDs */}
      <div className="space-y-4 border-t border-border/60 pt-6">
        <div>
          <h3 className="font-semibold">Tax Identification</h3>
          <p className="text-sm text-muted-foreground">Required for verification. Not shown publicly.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>EIN (Employer Identification Number)</Label>
            <Input
              value={form.ein_full}
              onChange={(e) => setForm((prev) => ({ ...prev, ein_full: formatEin(e.target.value) }))}
              placeholder="12-3456789"
              maxLength={10}
              className="mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">9-digit federal tax ID — admin only, never shown publicly</p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 md:mt-6">
            <div>
              <p className="text-sm font-medium">501(c)(3) Tax-Exempt</p>
              <p className="text-xs text-muted-foreground">Toggle on if your org holds tax-exempt status.</p>
            </div>
            <Switch
              checked={form.tax_exempt}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, tax_exempt: checked }))}
            />
          </div>
          {form.tax_exempt && (
            <div className="md:col-span-2">
              <Label>Tax-Exempt EIN</Label>
              <Input
                value={form.tax_exempt_ein}
                onChange={(e) => setForm((prev) => ({ ...prev, tax_exempt_ein: formatEin(e.target.value) }))}
                placeholder="12-3456789"
                maxLength={10}
                className="mt-1 font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* Credentials */}
      {vendorProfile?.id ? (
        <div className="border-t border-border/60 pt-6">
          <IndustryCredentialsSection
            vendorProfileId={vendorProfile.id}
            industry={form.industry || null}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          Save your vendor profile first to add professional credentials and license documents.
        </div>
      )}

      {/* Logo upload */}
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end border-t border-border/60 pt-6">
        <div>
          <Label>Logo URL</Label>
          <Input
            value={form.logo_url}
            onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
            placeholder="Upload a logo or paste the URL"
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={uploadingLogo || !user}
            onClick={() => document.getElementById('vendor-logo-upload')?.click()}
          >
            {uploadingLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload Logo
          </Button>
          <input
            id="vendor-logo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleLogoUpload(file)
              e.currentTarget.value = ''
            }}
          />
        </div>
      </div>
      {form.logo_url && (
        <div className="flex items-center gap-3">
          <img src={form.logo_url} alt="Logo preview" className="w-14 h-14 rounded-lg object-cover border border-border" />
          <p className="text-xs text-muted-foreground">Logo preview</p>
        </div>
      )}

      {/* Advertising opt-in */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
        <div>
          <p className="text-sm font-medium">Featured placement interest</p>
          <p className="text-xs text-muted-foreground">Let the team know if you want to be featured in the directory.</p>
        </div>
        <Switch
          checked={form.advertising_opt_in}
          onCheckedChange={(checked) => setForm((prev) => ({ ...prev, advertising_opt_in: checked }))}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !form.company_name.trim()}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Save Vendor Profile
        </Button>
      </div>
    </div>
  )
}
