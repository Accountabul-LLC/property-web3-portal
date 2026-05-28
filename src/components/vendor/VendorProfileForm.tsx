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
import { Loader2, Upload, Building2, Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { IndustryCredentialsSection } from './IndustryCredentialsSection'
import { INDUSTRIES, normalizeEin, einLast4 } from '@/lib/vendorCredentialCatalog'

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
    // Validate EIN if provided
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
      })
      toast.success('Vendor profile saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save vendor profile')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          <CardTitle>Vendor Profile</CardTitle>
          <Badge variant="outline" className="ml-auto">
            <Megaphone className="w-3.5 h-3.5 mr-1" />
            CRM Ready
          </Badge>
        </div>
        <CardDescription>
          Tell us about your business, your industry, and the licenses or certifications that verify you as a legitimate vendor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Company Name</Label>
            <Input
              value={form.company_name}
              onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
              placeholder="Acme Holdings LLC"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Industry</Label>
            <Select
              value={form.industry}
              onValueChange={(v) => setForm((prev) => ({ ...prev, industry: v }))}
            >
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
            <Label>Place of Business</Label>
            <Input
              value={form.place_of_business}
              onChange={(e) => setForm((prev) => ({ ...prev, place_of_business: e.target.value }))}
              placeholder="Dallas, TX"
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

        {/* Tax IDs */}
        <div className="space-y-4 border-t border-border/60 pt-6">
          <div>
            <h3 className="font-semibold">Tax Identification</h3>
            <p className="text-sm text-muted-foreground">Your federal EIN and (if applicable) 501(c)(3) tax-exempt status.</p>
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
              <p className="text-xs text-muted-foreground mt-1">9-digit federal tax ID, format XX-XXXXXXX</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 md:mt-6">
              <div>
                <p className="text-sm font-medium">501(c)(3) Tax-Exempt</p>
                <p className="text-xs text-muted-foreground">Toggle on if your organization holds tax-exempt status.</p>
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
          <IndustryCredentialsSection
            vendorProfileId={vendorProfile.id}
            industry={form.industry || null}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            Save your vendor profile first to add professional credentials and license documents.
          </div>
        )}

        {/* Logo */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end border-t border-border/60 pt-6">
          <div>
            <Label>Logo URL</Label>
            <Input
              value={form.logo_url}
              onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
              placeholder="Upload a logo or paste the URL here"
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" type="button" disabled={uploadingLogo || !user} onClick={() => document.getElementById('vendor-logo-upload')?.click()}>
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

        <div>
          <Label>Vendor Bio</Label>
          <Textarea
            value={form.vendor_bio}
            onChange={(e) => setForm((prev) => ({ ...prev, vendor_bio: e.target.value }))}
            placeholder="Describe your business and services in a few sentences."
            className="mt-1 min-h-[96px]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Advertising interest</p>
            <p className="text-xs text-muted-foreground">Let the team know if you want paid promotion support.</p>
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
      </CardContent>
    </Card>
  )
}
