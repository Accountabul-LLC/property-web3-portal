import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Search, RefreshCw, Building2, Mail, Phone, MapPin, Users, Megaphone, ShieldCheck, Clock3, FileText, CheckCircle2, Ban, AlertTriangle, Eye, WalletCards } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  getKycLabel,
  getVendorDisplayName,
  getVendorTone,
  getVendorVerificationLabel,
  getVendorTierLabel,
  isVendorBadgeVisible,
  isVendorProfileComplete,
  type VendorAdRequestStatus,
  type VendorApplicationRecord,
  type VendorKycCaseRecord,
  type VendorProfileRecord,
  type VendorProfileRow,
} from '@/lib/vendorNetwork'
import { callEdgeFunction } from '@/lib/edgeFunction'

type VendorCardRow = {
  vendor: VendorProfileRecord
  application: VendorApplicationRecord | null
  profile: VendorProfileRow | null
  kycCase: VendorKycCaseRecord | null
  hasVendorRecord: boolean
}

function getLatestByUser<T extends { user_id: string; created_at?: string; submitted_at?: string; applied_at?: string }>(rows: T[]) {
  const byUser = new Map<string, T>()
  for (const row of rows) {
    const existing = byUser.get(row.user_id)
    const currentStamp = new Date((row.created_at ?? row.submitted_at ?? row.applied_at ?? 0) as string | number).getTime()
    const existingStamp = existing
      ? new Date((existing.created_at ?? existing.submitted_at ?? existing.applied_at ?? 0) as string | number).getTime()
      : -1
    if (!existing || currentStamp >= existingStamp) {
      byUser.set(row.user_id, row)
    }
  }
  return byUser
}

function statusTone(status?: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  return getVendorTone(status)
}

function appStateLabel(application: VendorApplicationRecord | null) {
  if (!application) return 'No application'
  switch (application.status) {
    case 'applied':
      return 'Pending Review'
    case 'under_review':
      return 'Under Review'
    case 'approved':
      return 'Approved'
    case 'issued_pending_acceptance':
      return 'Awaiting Acceptance'
    case 'active':
      return 'Active'
    case 'rejected':
      return 'Denied'
    case 'expired':
      return 'Expired'
    case 'revoked':
      return 'Suspended'
    default:
      return application.status
  }
}

function adStatusLabel(status?: VendorAdRequestStatus | null) {
  switch (status) {
    case 'requested':
      return 'Ad requested'
    case 'pending_approval':
      return 'Ad pending approval'
    case 'approved':
      return 'Ad approved'
    case 'denied':
      return 'Ad denied'
    case 'active':
      return 'Ad active'
    case 'completed':
      return 'Ad completed'
    default:
      return 'No ad request'
  }
}

export default function VendorCRMPanel() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-vendor-crm'],
    queryFn: async () => {
      const [vendorRes, appRes, profileRes, kycRes] = await Promise.all([
        (supabase.from('vendor_profiles') as any).select('*').order('updated_at', { ascending: false }),
        (supabase.from('credential_applications') as any)
          .select('id, user_id, wallet_address, credential_key, status, applied_at, reviewed_at, reviewed_by, rejection_reason, issued_at, expires_at, accepted_at, revoked_at, revocation_reason, notes, wallet_credential_id')
          .eq('credential_key', 'vendor')
          .order('applied_at', { ascending: false }),
        (supabase.from('profiles') as any)
          .select('id, first_name, last_name, full_name, email, company_name, phone, account_type, avatar_url'),
        (supabase.from('kyc_cases') as any)
          .select('id, user_id, status, submitted_at, reviewed_at, rejection_reason, reviewer_id, created_at')
          .order('created_at', { ascending: false }),
      ])

      if (vendorRes.error) throw vendorRes.error
      if (appRes.error) throw appRes.error
      if (profileRes.error) throw profileRes.error
      if (kycRes.error) throw kycRes.error

      return {
        vendorProfiles: (vendorRes.data ?? []) as VendorProfileRecord[],
        vendorApplications: (appRes.data ?? []) as VendorApplicationRecord[],
        profiles: (profileRes.data ?? []) as VendorProfileRow[],
        kycCases: (kycRes.data ?? []) as VendorKycCaseRecord[],
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const records = useMemo(() => {
    const vendorProfiles = data?.vendorProfiles ?? []
    const appsByUser = getLatestByUser(data?.vendorApplications ?? [])
    const kycByUser = getLatestByUser(data?.kycCases ?? [])
    const profileById = new Map((data?.profiles ?? []).map((profile) => [profile.id, profile]))
    const profileByUser = new Map((data?.profiles ?? []).map((profile) => [profile.id, profile]))
    const vendorByUser = new Map(vendorProfiles.map((vendor) => [vendor.user_id, vendor]))
    const userIds = [...new Set([...vendorProfiles.map((vendor) => vendor.user_id), ...Array.from(appsByUser.keys())])]

    return userIds.map((userId) => {
      const application = appsByUser.get(userId) ?? null
      const existingVendor = vendorByUser.get(userId) ?? null
      const profile = profileById.get(existingVendor?.profile_id ?? userId) ?? profileByUser.get(userId) ?? null
      const kycCase = kycByUser.get(userId) ?? null
      const vendor = existingVendor ?? ({
        id: application?.id ?? userId,
        user_id: userId,
        profile_id: profile?.id ?? userId,
        slug: null,
        company_name: profile?.company_name ?? getVendorDisplayName(profile, null),
        logo_url: null,
        profile_headline: null,
        business_email: profile?.email ?? null,
        business_phone: profile?.phone ?? null,
        website_url: null,
        industry_category: null,
        business_description: null,
        service_areas: null,
        place_of_business: null,
        business_address_city: null,
        business_address_state: null,
        business_address_zip: null,
        years_in_business: null,
        employee_count: null,
        ein_last4: null,
        tax_exempt_number: null,
        applicant_title: null,
        advertising_opt_in: false,
        public_profile_visible: false,
        public_profile_enabled: false,
        subscription_status: 'inactive',
        payment_status: 'pending',
        ad_request_status: application ? 'requested' : 'no_request',
        vendor_tier: 'standard',
        verification_tier: 'unverified',
        verification_status:
          application?.status === 'approved'
            ? 'approved'
            : application?.status === 'rejected'
              ? 'denied'
              : application?.status === 'revoked'
                ? 'suspended'
                : application?.status === 'under_review'
                  ? 'under_review'
                  : 'requested',
        verified_at: null,
        requested_at: application?.applied_at ?? null,
        reviewed_at: application?.reviewed_at ?? null,
        reviewed_by: application?.reviewed_by ?? null,
        suspended_at: application?.revoked_at ?? null,
        suspended_by: null,
        suspension_reason: application?.revocation_reason ?? null,
        notes: application?.notes ?? null,
        created_at: application?.applied_at ?? new Date().toISOString(),
        updated_at: application?.applied_at ?? new Date().toISOString(),
      } as VendorProfileRecord)

      return {
        vendor,
        application,
        profile,
        kycCase,
        hasVendorRecord: !!existingVendor,
      } satisfies VendorCardRow
    })
  }, [data])

  const profileNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const profile of data?.profiles ?? []) {
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.full_name || profile.email || profile.id
      map.set(profile.id, name)
    }
    return map
  }, [data?.profiles])

  useEffect(() => {
    if (!selectedId && records.length > 0) {
      setSelectedId(records[0].vendor.user_id)
    }
  }, [records, selectedId])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = needle
      ? records.filter(({ vendor, application, profile, kycCase }) => {
          const haystack = [
            vendor.company_name,
            vendor.business_email ?? '',
            vendor.business_phone ?? '',
            vendor.place_of_business ?? '',
            vendor.industry_category ?? '',
            vendor.applicant_title ?? '',
            vendor.verification_status,
            application?.status ?? '',
            profile?.full_name ?? '',
            profile?.email ?? '',
            kycCase?.status ?? '',
          ]
            .join(' ')
            .toLowerCase()
          return haystack.includes(needle)
        })
      : records

    return [...list].sort((a, b) => {
      const priority = (item: VendorCardRow) => {
        if (['requested', 'under_review', 'more_info_needed'].includes(item.vendor.verification_status)) return 0
        if (item.vendor.verification_status === 'approved' && !isVendorBadgeVisible({
          applicationStatus: item.application?.status,
          kycStatus: item.kycCase?.status,
          vendor: item.vendor,
        })) return 1
        if (item.vendor.ad_request_status === 'requested' || item.vendor.ad_request_status === 'pending_approval') return 2
        return 3
      }
      return priority(a) - priority(b)
    })
  }, [records, search])

  const selected = filtered.find((item) => item.vendor.user_id === selectedId) ?? filtered[0] ?? null

  useEffect(() => {
    if (selected) {
      setReviewNote(selected.vendor.notes ?? selected.application?.notes ?? '')
    }
  }, [selected?.vendor.id, selected?.vendor.notes, selected?.application?.notes])

  const stats = useMemo(() => {
    const total = records.length
    const pending = records.filter(({ vendor }) => ['requested', 'under_review', 'more_info_needed'].includes(vendor.verification_status)).length
    const approved = records.filter(({ vendor, application, kycCase }) =>
      isVendorBadgeVisible({ applicationStatus: application?.status, kycStatus: kycCase?.status, vendor })
    ).length
    const ads = records.filter(({ vendor }) => vendor.ad_request_status !== 'no_request').length

    return { total, pending, approved, ads }
  }, [records])

  async function persistVendorUpdate(row: VendorCardRow, patch: Partial<VendorProfileRecord>, applicationPatch?: Partial<VendorApplicationRecord>) {
    if (!row) throw new Error('Vendor record not found')

    setBusyAction(row.vendor.user_id)
    try {
      const updates: Promise<unknown>[] = []
      const vendorPayload = {
        ...row.vendor,
        ...patch,
        user_id: row.vendor.user_id,
        profile_id: row.vendor.profile_id,
        company_name: patch.company_name ?? row.vendor.company_name,
        logo_url: patch.logo_url ?? row.vendor.logo_url,
        business_email: patch.business_email ?? row.vendor.business_email,
        business_phone: patch.business_phone ?? row.vendor.business_phone,
        website_url: patch.website_url ?? row.vendor.website_url,
        industry_category: patch.industry_category ?? row.vendor.industry_category,
        business_description: patch.business_description ?? row.vendor.business_description,
        service_areas: patch.service_areas ?? row.vendor.service_areas,
        place_of_business: patch.place_of_business ?? row.vendor.place_of_business,
        employee_count: patch.employee_count ?? row.vendor.employee_count,
        ein_last4: patch.ein_last4 ?? row.vendor.ein_last4,
        tax_exempt_number: patch.tax_exempt_number ?? row.vendor.tax_exempt_number,
        applicant_title: patch.applicant_title ?? row.vendor.applicant_title,
        advertising_opt_in: patch.advertising_opt_in ?? row.vendor.advertising_opt_in,
        public_profile_visible: patch.public_profile_visible ?? row.vendor.public_profile_visible,
        public_profile_enabled: patch.public_profile_enabled ?? row.vendor.public_profile_enabled,
        subscription_status: patch.subscription_status ?? row.vendor.subscription_status,
        payment_status: patch.payment_status ?? row.vendor.payment_status,
        ad_request_status: patch.ad_request_status ?? row.vendor.ad_request_status,
        vendor_tier: patch.vendor_tier ?? row.vendor.vendor_tier,
        verification_status: patch.verification_status ?? row.vendor.verification_status,
        verified_at: patch.verified_at ?? row.vendor.verified_at,
        requested_at: patch.requested_at ?? row.vendor.requested_at,
        reviewed_at: patch.reviewed_at ?? row.vendor.reviewed_at,
        reviewed_by: patch.reviewed_by ?? row.vendor.reviewed_by,
        suspended_at: patch.suspended_at ?? row.vendor.suspended_at,
        suspended_by: patch.suspended_by ?? row.vendor.suspended_by,
        suspension_reason: patch.suspension_reason ?? row.vendor.suspension_reason,
        notes: patch.notes ?? row.vendor.notes,
        updated_at: new Date().toISOString(),
      }
      updates.push((supabase.from('vendor_profiles') as any).upsert(vendorPayload, { onConflict: 'user_id' }))
      if (row.application && applicationPatch) {
        updates.push(
          (supabase.from('credential_applications') as any)
            .update({ ...applicationPatch, updated_at: new Date().toISOString() })
            .eq('id', row.application.id),
        )
      }
      const results = await Promise.all(updates)
      for (const result of results) {
        const maybe = result as { error?: { message?: string } }
        if (maybe?.error) throw new Error(maybe.error.message || 'Update failed')
      }
      qc.invalidateQueries({ queryKey: ['admin-vendor-crm'] })
      qc.invalidateQueries({ queryKey: ['admin-credential-applications'] })
    } finally {
      setBusyAction(null)
    }
  }

  async function approveVendor() {
    if (!selected) return
    await persistVendorUpdate(
      selected,
      {
        verification_status: 'verified',
        public_profile_visible: isVendorProfileComplete(selected.vendor),
        public_profile_enabled: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
        verified_at: new Date().toISOString(),
        notes: reviewNote || selected.vendor.notes,
        verification_tier: selected.vendor.verification_tier === 'unverified' ? 'business_verified' : selected.vendor.verification_tier,
      },
      {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
        notes: reviewNote || selected.application?.notes || null,
      },
    )
    toast.success('Vendor approved')
  }

  async function requestMoreInfo() {
    if (!selected) return
    const reason = reviewNote.trim()
    if (!reason) {
      toast.error('Add a note explaining what info is missing.')
      return
    }
    await persistVendorUpdate(
      selected,
      {
        verification_status: 'more_info_needed',
        reviewed_at: new Date().toISOString(),
        notes: reason,
      },
      {
        status: 'under_review',
        reviewed_by: user?.id ?? null,
        notes: reason,
      },
    )
    toast.success('Vendor sent back for more information')
  }

  async function denyVendor() {
    if (!selected) return
    const reason = reviewNote.trim()
    if (!reason) {
      toast.error('Add a denial reason.')
      return
    }
    await persistVendorUpdate(
      selected,
      {
        verification_status: 'denied',
        public_profile_visible: false,
        reviewed_at: new Date().toISOString(),
        notes: reason,
      },
      {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
        rejection_reason: reason,
        notes: reason,
      },
    )
    toast.success('Vendor denied')
  }

  async function approveAds() {
    if (!selected) return
    await persistVendorUpdate(selected, {
      ad_request_status: 'approved',
      advertising_opt_in: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
      notes: reviewNote || selected.vendor.notes,
    })
    toast.success('Advertising approved')
  }

  async function denyAds() {
    if (!selected) return
    const reason = reviewNote.trim()
    if (!reason) {
      toast.error('Add a note explaining why the ad request was denied.')
      return
    }
    await persistVendorUpdate(selected, {
      ad_request_status: 'denied',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
      notes: reason,
    })
    toast.success('Advertising denied')
  }

  async function suspendVendor() {
    if (!selected) return
    const reason = reviewNote.trim() || 'Admin suspension'
    setBusyAction(`${selected.vendor.user_id}-suspend`)
    try {
      if (selected.application?.wallet_credential_id) {
        await callEdgeFunction('revoke-credential', {
          credential_id: selected.application.wallet_credential_id,
          reason,
        })
      }
      await persistVendorUpdate(
        selected,
        {
          verification_status: 'suspended',
          public_profile_visible: false,
          suspended_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
          suspension_reason: reason,
          notes: reason,
        },
        {
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
          revocation_reason: reason,
          notes: reason,
        },
      )
      toast.success('Vendor suspended')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to suspend vendor')
    } finally {
      setBusyAction(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle>Verified Vendors</CardTitle>
                <CardDescription>Approval queue, KYC/KYB context, advertising requests, and marketplace status.</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total vendors</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Pending review</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Badge-ready</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ad requests</p>
              <p className="text-2xl font-bold text-primary">{stats.ads}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Applications</CardTitle>
          <CardDescription>Find a business by name, applicant, email, status, or KYC outcome.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors..." className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">No vendor applications found.</CardContent>
            </Card>
          ) : filtered.map(({ vendor, application, profile, kycCase }) => {
            const selected = vendor.user_id === selectedId
            const badgeVisible = isVendorBadgeVisible({
              applicationStatus: application?.status,
              kycStatus: kycCase?.status,
              vendor,
            })
            return (
              <Card
                key={vendor.user_id}
                className={`cursor-pointer transition-colors ${selected ? 'border-primary/40 bg-primary/5' : 'hover:border-primary/30 hover:bg-accent/20'}`}
                onClick={() => setSelectedId(vendor.user_id)}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 border">
                        {vendor.logo_url ? (
                          <img src={vendor.logo_url} alt={vendor.company_name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{vendor.company_name}</h3>
                          <Badge variant={statusTone(vendor.verification_status)}>
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            {getVendorVerificationLabel(vendor.verification_status)}
                          </Badge>
                          <Badge variant={statusTone(application?.status)}>
                            {appStateLabel(application)}
                          </Badge>
                          {badgeVisible && <Badge variant="default">Badge visible</Badge>}
                          {vendor.ad_request_status !== 'no_request' && (
                            <Badge variant={statusTone(vendor.ad_request_status)}>
                              <Megaphone className="w-3 h-3 mr-1" />
                              {adStatusLabel(vendor.ad_request_status)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getVendorDisplayName(profile, vendor)} - {profile?.account_type ?? 'business'} profile
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>Submitted {application?.applied_at ? new Date(application.applied_at).toLocaleString() : 'N/A'}</div>
                      <div className="mt-1">{kycCase?.status ? getKycLabel(kycCase.status) : 'KYC/KYB Not Started'}</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Business email</p>
                        <p className="font-medium break-all">{vendor.business_email ?? profile?.email ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium">{vendor.business_phone ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Business address</p>
                        <p className="font-medium">{vendor.place_of_business ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Employees</p>
                        <p className="font-medium">{vendor.employee_count ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="space-y-4">
          {!selected ? (
            <Card className="min-h-[420px]">
              <CardContent className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
                Select a vendor application to review the details.
              </CardContent>
            </Card>
          ) : (
            <Card className="sticky top-4">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-primary" />
                      Review detail
                    </CardTitle>
                    <CardDescription>Everything the admin needs to approve, deny, or suspend this vendor.</CardDescription>
                  </div>
                  <Badge variant={statusTone(selected.vendor.verification_status)}>
                    {getVendorVerificationLabel(selected.vendor.verification_status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl border bg-muted overflow-hidden flex items-center justify-center">
                    {selected.vendor.logo_url ? (
                      <img src={selected.vendor.logo_url} alt={selected.vendor.company_name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{selected.vendor.company_name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {getVendorDisplayName(selected.profile, selected.vendor)} - {selected.vendor.applicant_title ?? 'Applicant title not provided'}
                    </div>
                  </div>
                </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Marketplace status</div>
                      <div className="mt-1 font-medium">{appStateLabel(selected.application)}</div>
                    </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">KYC/KYB status</div>
                    <div className="mt-1 font-medium">{selected.kycCase ? getKycLabel(selected.kycCase.status) : 'KYC/KYB Not Started'}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Payment status</div>
                    <div className="mt-1 font-medium">{selected.vendor.payment_status}</div>
                  </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Subscription status</div>
                      <div className="mt-1 font-medium">{selected.vendor.subscription_status}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Vendor tier</div>
                      <div className="mt-1 font-medium">{selected.vendor.vendor_tier}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Verification tier</div>
                      <div className="mt-1 font-medium">{getVendorTierLabel(selected.vendor.verification_tier)}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Public profile live</div>
                      <div className="mt-1 font-medium">{selected.vendor.public_profile_enabled ? 'Yes' : 'No'}</div>
                    </div>
                  </div>

                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Company profile</div>
                    <div className="mt-1 font-medium">{selected.vendor.profile_headline ?? selected.vendor.industry_category ?? 'No category set'}</div>
                    <p className="mt-2 text-muted-foreground">{selected.vendor.business_description ?? 'No business description provided.'}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Website</div>
                      <div className="mt-1 font-medium break-all">{selected.vendor.website_url ?? 'N/A'}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Service areas</div>
                      <div className="mt-1 font-medium">{selected.vendor.service_areas ?? 'N/A'}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">EIN last 4</div>
                      <div className="mt-1 font-medium">{selected.vendor.ein_last4 ? `**** ${selected.vendor.ein_last4}` : 'N/A'}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Tax-exempt number</div>
                      <div className="mt-1 font-medium break-all">{selected.vendor.tax_exempt_number ?? 'N/A'}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Public profile visible</div>
                      <div className="mt-1 font-medium">{selected.vendor.public_profile_visible ? 'Yes' : 'No'}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Profile complete</div>
                      <div className="mt-1 font-medium">{isVendorProfileComplete(selected.vendor) ? 'Yes' : 'No'}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Verification tier</div>
                      <Select
                        value={selected.vendor.verification_tier}
                        onValueChange={(value) => {
                          void persistVendorUpdate(selected, { verification_tier: value })
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unverified">Unverified</SelectItem>
                          <SelectItem value="business_verified">Business Verified</SelectItem>
                          <SelectItem value="credential_verified">Credential Verified</SelectItem>
                          <SelectItem value="platform_vouched">Platform Vouched</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Public profile enabled</div>
                          <div className="mt-1 text-sm text-muted-foreground">Show this vendor in the public directory.</div>
                        </div>
                        <Switch
                          checked={selected.vendor.public_profile_enabled}
                          onCheckedChange={(checked) => {
                            void persistVendorUpdate(selected, { public_profile_enabled: checked })
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">Review notes</div>
                  <Textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Use this for the approval reason, denial reason, or requested changes."
                    className="min-h-[110px]"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={approveVendor} disabled={busyAction === selected.vendor.user_id}>
                    {busyAction === selected.vendor.user_id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Approve Vendor
                  </Button>
                  <Button variant="destructive" onClick={denyVendor} disabled={busyAction === selected.vendor.user_id}>
                    <Ban className="w-4 h-4 mr-2" />
                    Deny Vendor
                  </Button>
                  <Button variant="outline" onClick={requestMoreInfo} disabled={busyAction === selected.vendor.user_id}>
                    <FileText className="w-4 h-4 mr-2" />
                    Request More Info
                  </Button>
                  <Button variant="outline" onClick={suspendVendor} disabled={busyAction === `${selected.vendor.user_id}-suspend`}>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Suspend Vendor
                  </Button>
                  <Button variant="outline" onClick={approveAds} disabled={busyAction === selected.vendor.user_id}>
                    <Megaphone className="w-4 h-4 mr-2" />
                    Approve Ads
                  </Button>
                  <Button variant="outline" onClick={denyAds} disabled={busyAction === selected.vendor.user_id}>
                    <Megaphone className="w-4 h-4 mr-2" />
                    Deny Ads
                  </Button>
                </div>

                <Separator />

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Applicant email</div>
                      <div className="font-medium break-all">{selected.profile?.email ?? selected.vendor.business_email ?? 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Applicant phone</div>
                      <div className="font-medium">{selected.profile?.phone ?? selected.vendor.business_phone ?? 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock3 className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Submitted</div>
                      <div className="font-medium">{selected.application?.applied_at ? new Date(selected.application.applied_at).toLocaleString() : 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <WalletCards className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Wallet</div>
                      <div className="font-medium break-all">{selected.application?.wallet_address ?? 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Reviewed at</div>
                    <div className="mt-1 font-medium">{selected.vendor.reviewed_at ? new Date(selected.vendor.reviewed_at).toLocaleString() : 'N/A'}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Reviewed by</div>
                    <div className="mt-1 font-medium">
                      {selected.vendor.reviewed_by ? profileNames.get(selected.vendor.reviewed_by) ?? selected.vendor.reviewed_by : 'N/A'}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Verified at</div>
                    <div className="mt-1 font-medium">{selected.vendor.verified_at ? new Date(selected.vendor.verified_at).toLocaleString() : 'N/A'}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Requested at</div>
                    <div className="mt-1 font-medium">{selected.vendor.requested_at ? new Date(selected.vendor.requested_at).toLocaleString() : 'N/A'}</div>
                  </div>
                </div>

                {selected.application?.rejection_reason ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    <div className="font-medium">Denial reason</div>
                    <p className="mt-1">{selected.application.rejection_reason}</p>
                  </div>
                ) : null}

                {selected.vendor.suspension_reason ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
                    <div className="font-medium">Suspension note</div>
                    <p className="mt-1">{selected.vendor.suspension_reason}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
