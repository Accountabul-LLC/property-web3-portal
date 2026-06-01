import { useEffect, useState } from 'react'
import { Loader2, Upload, Building2, Megaphone, BriefcaseBusiness, Globe, MapPin, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useVendorProfile } from '@/hooks/useVendorProfile'
import { useProfileVerifications } from '@/hooks/useProfileVerifications'
import VerifiedBadge from '@/components/profile/VerifiedBadge'
import {
  getVendorDisplayName,
  getVendorPublicUrl,
  slugifyVendorName,
  getVendorVerificationLabel,
  isVendorProfileComplete,
  type VendorProfileRecord,
} from '@/lib/vendorNetwork'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

interface VendorProfileFormProps {
  profileId: string | null | undefined
  companyName: string | null | undefined
}

export function VendorProfileForm({ profileId, companyName }: VendorProfileFormProps) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const verifications = useProfileVerifications()
  const { vendorProfile, isLoading, saveVendorProfile } = useVendorProfile(profileId)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [form, setForm] = useState({
    company_name: companyName ?? '',
    logo_url: '',
    profile_headline: '',
    business_email: '',
    business_phone: '',
    website_url: '',
    industry_category: '',
    business_description: '',
    service_areas: '',
    place_of_business: '',
    business_address_city: '',
    business_address_state: '',
    business_address_zip: '',
    years_in_business: '',
    year_founded: '',
    employee_count: '',
    ein_last4: '',
    tax_exempt_number: '',
    applicant_title: '',
    advertising_opt_in: false,
    public_profile_visible: false,
  })

  useEffect(() => {
    const vp = vendorProfile as VendorProfileRecord | null
    // Prefill empty business contact/address fields from the user's personal profile.
    const pEmail = profile?.email ?? ''
    const pPhone = profile?.phone ?? ''
    const pCity = profile?.city ?? ''
    const pState = profile?.state ?? ''
    const pZip = profile?.zip ?? ''
    const placeFromProfile = [pCity, pState].filter(Boolean).join(', ')
    setForm({
      company_name: vp?.company_name ?? companyName ?? '',
      logo_url: vp?.logo_url ?? '',
      profile_headline: vp?.profile_headline ?? '',
      business_email: vp?.business_email ?? pEmail ?? '',
      business_phone: vp?.business_phone ?? pPhone ?? '',
      website_url: vp?.website_url ?? '',
      industry_category: vp?.industry_category ?? '',
      business_description: vp?.business_description ?? '',
      service_areas: vp?.service_areas ?? '',
      place_of_business: vp?.place_of_business ?? placeFromProfile,
      business_address_city: vp?.business_address_city ?? pCity,
      business_address_state: vp?.business_address_state ?? pState,
      business_address_zip: vp?.business_address_zip ?? pZip,
      years_in_business: vp?.years_in_business?.toString() ?? '',
      year_founded: (vp as any)?.year_founded?.toString() ?? '',
      employee_count: vp?.employee_count?.toString() ?? '',
      ein_last4: vp?.ein_last4 ?? '',
      tax_exempt_number: vp?.tax_exempt_number ?? '',
      applicant_title: vp?.applicant_title ?? '',
      advertising_opt_in: vp?.advertising_opt_in ?? false,
      public_profile_visible: vp?.public_profile_visible ?? false,
    })
  }, [vendorProfile, companyName, profile])

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

  async function handleSave() {
    setSaving(true)
    try {
      await saveVendorProfile({
        company_name: form.company_name.trim(),
        logo_url: form.logo_url.trim() || null,
        profile_headline: form.profile_headline.trim() || null,
        business_email: form.business_email.trim() || null,
        business_phone: form.business_phone.trim() || null,
        website_url: form.website_url.trim() || null,
        industry_category: form.industry_category.trim() || null,
        business_description: form.business_description.trim() || null,
        service_areas: form.service_areas.trim() || null,
        place_of_business: form.place_of_business.trim() || null,
        business_address_city: form.business_address_city.trim() || null,
        business_address_state: form.business_address_state.trim() || null,
        business_address_zip: form.business_address_zip.trim() || null,
        years_in_business: form.years_in_business ? Number(form.years_in_business) : null,
        year_founded: form.year_founded ? Number(form.year_founded) : null,
        employee_count: form.employee_count ? Number(form.employee_count) : null,
        ein_last4: form.ein_last4.trim() || null,
        tax_exempt_number: form.tax_exempt_number.trim() || null,
        applicant_title: form.applicant_title.trim() || null,
        advertising_opt_in: form.advertising_opt_in,
        public_profile_visible: form.public_profile_visible,
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

  const status = vendorProfile?.verification_status ?? 'not_requested'
  const kycSummary = vendorProfile && vendorProfile.verification_status !== 'not_requested'
    ? 'Admin-reviewed vendor profile'
    : 'Vendor profile not yet submitted'
  const previewSlug = vendorProfile?.slug ?? slugifyVendorName(form.company_name)

  return (
    <Card className="mb-8 border-border/70 bg-card/90">
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <Building2 className="w-5 h-5" />
          <CardTitle>Vendor Profile</CardTitle>
          <Badge variant="outline" className="ml-auto">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            {getVendorVerificationLabel(status)}
          </Badge>
        </div>
        <CardDescription>
          Provide the business details that the admin approval queue will review first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Profile state</div>
            <div className="mt-1 font-medium">{getVendorVerificationLabel(status)}</div>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">KYC/KYB</div>
            <div className="mt-1 font-medium">{kycSummary}</div>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Profile complete</div>
            <div className="mt-1 font-medium">{isVendorProfileComplete(vendorProfile) ? 'Yes' : 'No'}</div>
          </div>
        </div>

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
            <Label>Applicant Title</Label>
            <Input
              value={form.applicant_title}
              onChange={(e) => setForm((prev) => ({ ...prev, applicant_title: e.target.value }))}
              placeholder="Owner, COO, Operations Lead"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Profile Headline</Label>
            <Input
              value={form.profile_headline}
              onChange={(e) => setForm((prev) => ({ ...prev, profile_headline: e.target.value }))}
              placeholder="Trusted residential electrician serving the St. Louis metro"
              className="mt-1"
            />
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
              type="url"
              value={form.website_url}
              onChange={(e) => setForm((prev) => ({ ...prev, website_url: e.target.value }))}
              placeholder="https://acme.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Industry / Category</Label>
            <Input
              value={form.industry_category}
              onChange={(e) => setForm((prev) => ({ ...prev, industry_category: e.target.value }))}
              placeholder="Insurance, Cleaning, Legal"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Place of Business</Label>
            <Input
              value={form.place_of_business}
              onChange={(e) => setForm((prev) => ({ ...prev, place_of_business: e.target.value }))}
              placeholder="St. Louis, MO"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1">Business City
              {verifications.isVerified('city', form.business_address_city) && (
                <VerifiedBadge source={verifications.getVerification('city')!.source} verifiedAt={verifications.getVerification('city')!.verified_at} />
              )}
            </Label>
            <Input
              value={form.business_address_city}
              onChange={(e) => setForm((prev) => ({ ...prev, business_address_city: e.target.value }))}
              placeholder="St. Louis"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1">Business State
              {verifications.isVerified('state', form.business_address_state) && (
                <VerifiedBadge source={verifications.getVerification('state')!.source} verifiedAt={verifications.getVerification('state')!.verified_at} />
              )}
            </Label>
            <Input
              value={form.business_address_state}
              onChange={(e) => setForm((prev) => ({ ...prev, business_address_state: e.target.value.toUpperCase().slice(0, 2) }))}
              placeholder="MO"
              className="mt-1"
              maxLength={2}
            />
          </div>
          <div>
            <Label className="flex items-center gap-1">Business ZIP
              {verifications.isVerified('zip', form.business_address_zip) && (
                <VerifiedBadge source={verifications.getVerification('zip')!.source} verifiedAt={verifications.getVerification('zip')!.verified_at} />
              )}
            </Label>
            <Input
              value={form.business_address_zip}
              onChange={(e) => setForm((prev) => ({ ...prev, business_address_zip: e.target.value.replace(/[^\d-]/g, '').slice(0, 10) }))}
              placeholder="63101"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Year Founded</Label>
            <Input
              type="number"
              min="1800"
              max={new Date().getFullYear()}
              value={form.year_founded}
              onChange={(e) => setForm((prev) => ({ ...prev, year_founded: e.target.value }))}
              placeholder={String(new Date().getFullYear() - 5)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Years in Business</Label>
            <Input
              type="number"
              min="0"
              value={form.years_in_business}
              onChange={(e) => setForm((prev) => ({ ...prev, years_in_business: e.target.value }))}
              placeholder="5"
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
          <div>
            <Label>EIN Last 4</Label>
            <Input
              value={form.ein_last4}
              onChange={(e) => setForm((prev) => ({ ...prev, ein_last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="1234"
              className="mt-1"
              maxLength={4}
            />
          </div>
          <div>
            <Label>Tax-Exempt Number</Label>
            <Input
              value={form.tax_exempt_number}
              onChange={(e) => setForm((prev) => ({ ...prev, tax_exempt_number: e.target.value }))}
              placeholder="If applicable"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label>Business Description</Label>
          <Textarea
            value={form.business_description}
            onChange={(e) => setForm((prev) => ({ ...prev, business_description: e.target.value }))}
            placeholder="Describe the company, services, and what the marketplace should know."
            className="mt-1 min-h-[110px]"
          />
        </div>

        <div>
          <Label>Service Areas</Label>
          <Textarea
            value={form.service_areas}
            onChange={(e) => setForm((prev) => ({ ...prev, service_areas: e.target.value }))}
            placeholder="City, state, region, or neighborhoods served."
            className="mt-1 min-h-[90px]"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
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

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Advertising interest</p>
            <p className="text-xs text-muted-foreground">Lets the admin know whether this application includes an ad request.</p>
          </div>
          <Switch
            checked={form.advertising_opt_in}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, advertising_opt_in: checked }))}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Public profile visible</p>
            <p className="text-xs text-muted-foreground">Keep this off until the admin approval flow is complete.</p>
          </div>
          <Switch
            checked={form.public_profile_visible}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, public_profile_visible: checked }))}
          />
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <BriefcaseBusiness className="w-4 h-4" />
            {getVendorDisplayName(undefined, vendorProfile)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {form.website_url || 'No website added yet'}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {form.place_of_business || 'No business address added yet'}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            {form.advertising_opt_in ? 'Advertising request included' : 'No advertising request yet'}
          </div>
          {previewSlug ? (
            <div className="mt-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Future public URL: {getVendorPublicUrl(previewSlug)}
            </div>
          ) : null}
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
