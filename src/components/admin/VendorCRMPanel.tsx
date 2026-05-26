import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { callEdgeFunction } from '@/lib/edgeFunction'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Loader2, Star, Search, Building2, Mail, Phone, MapPin, Users, Megaphone, ShieldCheck, RefreshCw, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'

type VendorProfile = {
  id: string
  user_id: string
  profile_id: string
  company_name: string
  logo_url: string | null
  business_email: string | null
  business_phone: string | null
  place_of_business: string | null
  employee_count: number | null
  ein_last4: string | null
  advertising_opt_in: boolean
  vendor_bio: string | null
  verification_status: 'not_requested' | 'requested' | 'under_review' | 'verified' | 'rejected' | 'revoked'
  verified_at: string | null
  requested_at: string | null
  reviewed_at: string | null
  notes: string | null
}

type VendorApplication = {
  id: string
  user_id: string
  wallet_address: string
  credential_key: string
  status: string
  applied_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  issued_at: string | null
  expires_at: string | null
  accepted_at: string | null
  revoked_at: string | null
  notes: string | null
  wallet_credential_id: string | null
}

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  company_name: string | null
  account_type: string | null
  avatar_url: string | null
}

function displayName(profile: ProfileRow | undefined, vendor: VendorProfile | undefined) {
  if (vendor?.company_name) return vendor.company_name
  if (profile?.company_name) return profile.company_name
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.full_name || 'Unknown'
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'verified' || status === 'active') return 'default'
  if (status === 'under_review' || status === 'requested' || status === 'approved') return 'secondary'
  if (status === 'rejected' || status === 'revoked' || status === 'expired') return 'destructive'
  return 'outline'
}

function roleChip(vendor: VendorProfile | undefined) {
  if (!vendor) return null
  if (vendor.verification_status === 'verified') return 'Verified Vendor'
  if (vendor.verification_status === 'under_review') return 'Under Review'
  if (vendor.verification_status === 'requested') return 'Requested'
  return vendor.verification_status
}

export default function VendorCRMPanel() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [actioning, setActioning] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-vendor-crm'],
    queryFn: async () => {
      const [vendorRes, appRes, profileRes] = await Promise.all([
        (supabase.from('vendor_profiles') as any).select('*').order('updated_at', { ascending: false }),
        (supabase.from('credential_applications') as any)
          .select('id, user_id, wallet_address, credential_key, status, applied_at, reviewed_at, rejection_reason, issued_at, expires_at, accepted_at, revoked_at, notes, wallet_credential_id')
          .eq('credential_key', 'vendor')
          .order('applied_at', { ascending: false }),
        (supabase.from('profiles') as any)
          .select('id, first_name, last_name, full_name, email, company_name, account_type, avatar_url'),
      ])

      if (vendorRes.error) throw vendorRes.error
      if (appRes.error) throw appRes.error
      if (profileRes.error) throw profileRes.error

      return {
        vendorProfiles: (vendorRes.data ?? []) as VendorProfile[],
        vendorApps: (appRes.data ?? []) as VendorApplication[],
        profiles: (profileRes.data ?? []) as ProfileRow[],
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const vendorProfiles = data?.vendorProfiles ?? []
  const vendorApps = data?.vendorApps ?? []
  const profiles = data?.profiles ?? []

  const merged = useMemo(() => {
    const profilesById = new Map(profiles.map((p) => [p.id, p]))
    const profilesByUser = new Map(profiles.map((p) => [p.id, p]))
    const appsByUser = new Map(vendorApps.map((a) => [a.user_id, a]))

    return vendorProfiles.map((vendor) => ({
      vendor,
      profile: profilesById.get(vendor.profile_id) ?? profilesByUser.get(vendor.user_id),
      app: appsByUser.get(vendor.user_id) ?? null,
    }))
  }, [vendorProfiles, vendorApps, profiles])

  const filtered = merged.filter(({ vendor, profile }) => {
    const haystack = [
      vendor.company_name,
      vendor.business_email ?? '',
      vendor.business_phone ?? '',
      vendor.place_of_business ?? '',
      displayName(profile, vendor),
      profile?.email ?? '',
      vendor.verification_status,
    ].join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  const stats = {
    total: merged.length,
    verified: merged.filter((row) => row.vendor.verification_status === 'verified').length,
    underReview: merged.filter((row) => ['requested', 'under_review'].includes(row.vendor.verification_status)).length,
    ads: merged.filter((row) => row.vendor.advertising_opt_in).length,
  }

  async function runAction(applicationId: string, action: 'start_review' | 'approve' | 'reject' | 'issue', extra?: Record<string, unknown>) {
    setActioning(applicationId + action)
    try {
      await callEdgeFunction('review-credential-application', { application_id: applicationId, action, ...extra })
      toast.success(`Vendor ${action.replace('_', ' ')} complete`)
      qc.invalidateQueries({ queryKey: ['admin-vendor-crm'] })
      qc.invalidateQueries({ queryKey: ['admin-credential-applications'] })
      qc.invalidateQueries({ queryKey: ['admin-credential-ledger'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Vendor action failed')
    } finally {
      setActioning(null)
    }
  }

  async function runRevoke(applicationId: string) {
    setActioning(applicationId + 'revoke')
    try {
      const app = vendorApps.find((a) => a.id === applicationId)
      if (!app?.wallet_credential_id) throw new Error('No wallet credential linked to this application')
      await callEdgeFunction('revoke-credential', { credential_id: app.wallet_credential_id, reason: 'Admin vendor revocation' })
      toast.success('Vendor credential revoked')
      qc.invalidateQueries({ queryKey: ['admin-vendor-crm'] })
      qc.invalidateQueries({ queryKey: ['admin-credential-ledger'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revocation failed')
    } finally {
      setActioning(null)
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
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle>Verified Vendors</CardTitle>
                <CardDescription>Business accounts, verification queue, and CRM details.</CardDescription>
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
              <p className="text-xs text-muted-foreground">Verified</p>
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">In review</p>
              <p className="text-2xl font-bold text-amber-600">{stats.underReview}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Advertising opt-in</p>
              <p className="text-2xl font-bold text-primary">{stats.ads}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Vendors</CardTitle>
          <CardDescription>Find a business by name, email, location, or verification status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendors..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No vendors found.
            </CardContent>
          </Card>
        ) : filtered.map(({ vendor, profile, app }) => (
          <Card key={vendor.id}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {vendor.logo_url ? (
                      <img src={vendor.logo_url} alt={vendor.company_name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{vendor.company_name}</h3>
                      <Badge variant={statusVariant(vendor.verification_status)}>
                        <Star className="w-3 h-3 mr-1" />
                        {roleChip(vendor)}
                      </Badge>
                      {vendor.advertising_opt_in && (
                        <Badge variant="outline" className="gap-1">
                          <Megaphone className="w-3 h-3" />
                          Ads
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {displayName(profile, vendor)} · {profile?.account_type ?? 'business'} profile
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {app && app.status === 'applied' && (
                    <Button size="sm" variant="outline" disabled={actioning === app.id + 'start_review'} onClick={() => runAction(app.id, 'start_review')}>
                      {actioning === app.id + 'start_review' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Start Review
                    </Button>
                  )}
                  {app && app.status === 'under_review' && (
                    <Button size="sm" disabled={actioning === app.id + 'approve'} onClick={() => runAction(app.id, 'approve')}>
                      {actioning === app.id + 'approve' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Approve
                    </Button>
                  )}
                  {app && app.status === 'approved' && (
                    <Button size="sm" disabled={actioning === app.id + 'issue'} onClick={() => runAction(app.id, 'issue')}>
                      {actioning === app.id + 'issue' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Issue Badge
                    </Button>
                  )}
                  {app && ['issued_pending_acceptance', 'issued', 'active'].includes(app.status) && (
                    <Button size="sm" variant="destructive" disabled={actioning === app.id + 'revoke'} onClick={() => runRevoke(app.id)}>
                      {actioning === app.id + 'revoke' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Revoke
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Business email</p>
                    <p className="font-medium break-all">{vendor.business_email ?? profile?.email ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{vendor.business_phone ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium">{vendor.place_of_business ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Employees</p>
                    <p className="font-medium">{vendor.employee_count ?? '—'}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">EIN last 4</p>
                  <p className="font-medium">{vendor.ein_last4 ? `•••• ${vendor.ein_last4}` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Requested</p>
                  <p className="font-medium">{vendor.requested_at ? new Date(vendor.requested_at).toLocaleString() : app?.applied_at ? new Date(app.applied_at).toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reviewed</p>
                  <p className="font-medium">{vendor.reviewed_at ? new Date(vendor.reviewed_at).toLocaleString() : app?.reviewed_at ? new Date(app.reviewed_at).toLocaleString() : '—'}</p>
                </div>
              </div>

              {vendor.vendor_bio && (
                <p className="text-sm text-muted-foreground">{vendor.vendor_bio}</p>
              )}

              {app?.rejection_reason && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <XCircle className="w-4 h-4" />
                    Rejection Reason
                  </div>
                  {app.rejection_reason}
                </div>
              )}

              {app?.notes && (
                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    Admin Notes
                  </div>
                  {app.notes}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
