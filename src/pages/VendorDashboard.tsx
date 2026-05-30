import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, Building2, ExternalLink, Globe,
  Loader2, Mail, MessageSquare, ShieldCheck, Users2,
} from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VendorBenefitsCard } from '@/components/vendor/VendorBenefitsCard'
import { VendorNetworkCard } from '@/components/vendor/VendorNetworkCard'
import { useVendorApplication } from '@/hooks/useVendorApplication'
import { useVendorProfile } from '@/hooks/useVendorProfile'
import { useVendorLeads } from '@/hooks/useVendorLeads'
import { getVendorNextRoute, normalizeVendorStatus } from '@/lib/vendorFlow'
import { getVendorCredential } from '@/lib/vendorNetwork'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { useProfile } from '@/hooks/useProfile'
import { useKycStatus } from '@/hooks/useKycStatus'
import { useCredentialEligibility } from '@/hooks/useCredentialEligibility'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  closed: 'Closed',
  spam: 'Spam',
  archived: 'Archived',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'default',
  contacted: 'secondary',
  closed: 'outline',
  spam: 'destructive',
  archived: 'outline',
}

export default function VendorDashboard() {
  const navigate = useNavigate()
  const { vendorApplication, isLoading, user } = useVendorApplication()
  const { activeAddress } = useActiveWallet()
  const { profile } = useProfile()
  const { isApproved: kycApproved } = useKycStatus()
  const { results: credentialResults } = useCredentialEligibility(activeAddress ?? null)
  const { vendorProfile } = useVendorProfile(profile?.id)

  const vendorCredential = getVendorCredential(credentialResults)
  const { leads, isLoading: leadsLoading, updateStatus, newCount } = useVendorLeads(vendorProfile?.id)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      navigate('/auth?next=/vendor/dashboard', { replace: true })
      return
    }
    const normalized = normalizeVendorStatus(vendorApplication?.status)
    if (normalized === 'none') {
      navigate('/vendor/onboarding', { replace: true })
      return
    }
    if (normalized !== 'active') {
      navigate(getVendorNextRoute(normalized), { replace: true })
    }
  }, [isLoading, navigate, user, vendorApplication?.status])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const normalized = normalizeVendorStatus(vendorApplication?.status)
  const publicUrl = vendorProfile?.slug
    ? `${window.location.origin}/vendor/${vendorProfile.slug}`
    : null

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Vendor Dashboard | Accountabul"
        description="Manage your verified vendor profile, leads, and marketplace exposure on Accountabul."
        path="/vendor/dashboard"
        noindex
      />
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">

        <VendorNetworkCard
          accountType={profile?.account_type}
          companyName={profile?.company_name}
          isConnected={!!activeAddress}
          kycApproved={kycApproved}
          vendorCredential={vendorCredential}
          actionLoading={false}
          onConnectWallet={() => navigate('/dashboard')}
          onStartKyc={() => navigate('/kyc')}
          onEditProfile={() => navigate('/settings')}
          onRequestVerification={() => navigate('/vendor/onboarding')}
          onAcceptBadge={() => navigate('/credentials')}
          onOpenCredentials={() => navigate('/credentials')}
        />

        {/* Public profile quick link */}
        {publicUrl && vendorProfile?.public_profile_enabled && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <Globe className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Your public profile is live</p>
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
            <Button size="sm" variant="outline" onClick={() => {
              navigator.clipboard.writeText(publicUrl)
              toast.success('Profile link copied!')
            }}>
              Copy link
            </Button>
          </div>
        )}
        {publicUrl && !vendorProfile?.public_profile_enabled && (
          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <Globe className="w-4 h-4 flex-shrink-0" />
            Your public profile is not live yet. Complete your profile in onboarding and contact support to enable it.
          </div>
        )}

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="leads" className="relative">
              Leads
              {newCount > 0 && (
                <Badge className="ml-2 h-5 min-w-[1.25rem] px-1 text-[10px]">{newCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview tab ── */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-border/70 bg-card/95 shadow-card">
                <CardHeader>
                  <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                    <BadgeCheck className="mr-2 h-3.5 w-3.5" />
                    Verified vendor
                  </Badge>
                  <CardTitle className="text-3xl">Vendor dashboard</CardTitle>
                  <CardDescription>
                    Your approved business home on Accountabul.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl bg-muted/40 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</div>
                    <div className="mt-1 font-medium capitalize">{normalized.replace('_', ' ')}</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Unread leads</div>
                    <div className="mt-1 font-medium">{newCount > 0 ? `${newCount} new` : 'No new leads'}</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Trust tier</div>
                    <div className="mt-1 font-medium capitalize">
                      {(vendorProfile?.verification_tier ?? 'unverified').replace('_', ' ')}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link to="/vendors">
                        View directory
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/vendor/onboarding">Edit profile</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-border/70 bg-card/95 shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Building2 className="h-5 w-5 text-primary" />
                      Vendor tools
                    </CardTitle>
                    <CardDescription>Your business control center.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <Users2 className="mb-2 h-5 w-5 text-primary" />
                      <p className="font-medium">Customer leads</p>
                      <p className="text-sm text-muted-foreground">
                        {newCount > 0 ? `${newCount} new lead${newCount > 1 ? 's' : ''} waiting` : 'No new leads yet'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
                      <p className="font-medium">Trust badge</p>
                      <p className="text-sm text-muted-foreground">Your verified badge is visible to users.</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <BadgeCheck className="mb-2 h-5 w-5 text-primary" />
                      <p className="font-medium">Marketplace placement</p>
                      <p className="text-sm text-muted-foreground">Featured placement requests via support.</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <Globe className="mb-2 h-5 w-5 text-primary" />
                      <p className="font-medium">Public profile</p>
                      <p className="text-sm text-muted-foreground">
                        {vendorProfile?.public_profile_enabled ? 'Live and discoverable' : 'Not yet enabled'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <VendorBenefitsCard
                  primaryHref="/vendor/status"
                  primaryLabel="Review status"
                  secondaryHref="/vendors"
                  secondaryLabel="Open directory"
                />
              </div>
            </div>
          </TabsContent>

          {/* ── Leads tab ── */}
          <TabsContent value="leads" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      Customer Leads
                    </CardTitle>
                    <CardDescription>Messages sent to you through the vendor directory.</CardDescription>
                  </div>
                  {newCount > 0 && (
                    <Badge>{newCount} new</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : leads.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground text-sm">No leads yet.</p>
                    <p className="text-xs text-muted-foreground">
                      When someone contacts you through your public profile or the vendor directory, their message appears here.
                    </p>
                    {publicUrl && (
                      <Button size="sm" variant="outline" onClick={() => {
                        navigator.clipboard.writeText(publicUrl)
                        toast.success('Profile link copied!')
                      }}>
                        Copy your profile link to share
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leads.map((lead) => (
                      <div key={lead.id} className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-medium">{lead.requester_name}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <a href={`mailto:${lead.requester_email}`} className="hover:text-foreground flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" />
                                {lead.requester_email}
                              </a>
                              {lead.requester_phone && (
                                <a href={`tel:${lead.requester_phone}`} className="hover:text-foreground">
                                  {lead.requester_phone}
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={(STATUS_COLORS[lead.status] ?? 'outline') as any}>
                              {STATUS_LABELS[lead.status] ?? lead.status}
                            </Badge>
                            <Select
                              value={lead.status}
                              onValueChange={(val) =>
                                updateStatus.mutate(
                                  { leadId: lead.id, status: val as any },
                                  { onError: () => toast.error('Failed to update status') }
                                )
                              }
                            >
                              <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                  <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {lead.service_needed && (
                          <p className="text-sm"><span className="text-muted-foreground">Service: </span>{lead.service_needed}</p>
                        )}
                        {lead.property_address && (
                          <p className="text-sm"><span className="text-muted-foreground">Property: </span>{lead.property_address}</p>
                        )}
                        {lead.message && (
                          <>
                            <Separator />
                            <p className="text-sm text-muted-foreground whitespace-pre-line">{lead.message}</p>
                          </>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString()} · via {lead.source.replace('_', ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  )
}
