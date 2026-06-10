import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Building2, ExternalLink, Loader2, ShieldCheck, Users2, MessageCircle, Clock3, CheckCircle2 } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VendorBenefitsCard } from '@/components/vendor/VendorBenefitsCard'
import { useVendorApplication } from '@/hooks/useVendorApplication'
import { useProfile } from '@/hooks/useProfile'
import { useVendorProfile } from '@/hooks/useVendorProfile'
import { useVendorLeads } from '@/hooks/useVendorLeads'
import { getVendorNextRoute, normalizeVendorStatus } from '@/lib/vendorFlow'
import { getVendorPublicUrl } from '@/lib/vendorNetwork'

export default function VendorDashboard() {
  const navigate = useNavigate()
  const { vendorApplication, status, isLoading, user } = useVendorApplication()
  const { profile } = useProfile()
  const { vendorProfile } = useVendorProfile(profile?.id ?? null)
  const { leads, isLoading: leadsLoading, updateLeadStatus } = useVendorLeads(vendorProfile?.id ?? null)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      navigate('/auth?next=/vendors/dashboard', { replace: true })
      return
    }
    // Only bounce to onboarding when there's truly no application AND no vendor profile.
    if (status === 'none' && !vendorProfile) {
      navigate('/vendors/apply', { replace: true })
    }
  }, [isLoading, navigate, user, status, vendorProfile])


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const normalized = normalizeVendorStatus(vendorApplication?.status)
  const unreadLeads = leads.filter((lead) => lead.status === 'new').length

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Vendor Dashboard | Accountabul"
        description="Manage your verified vendor profile, marketplace exposure, and business tools on Accountabul."
        path="/vendors/dashboard"
        noindex
      />
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/70 bg-card/95 shadow-card">
            <CardHeader>
              <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                <BadgeCheck className="mr-2 h-3.5 w-3.5" />
                Verified vendor
              </Badge>
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-3xl">Vendor dashboard</CardTitle>
                {unreadLeads > 0 ? <Badge variant="secondary">{unreadLeads} new lead{unreadLeads === 1 ? '' : 's'}</Badge> : null}
              </div>
              <CardDescription>
                This is the operational home for approved businesses on Accountabul.
              </CardDescription>
              {vendorProfile?.slug ? (
                <Button asChild size="sm" variant="outline" className="mt-2 w-fit">
                  <a href={getVendorPublicUrl(vendorProfile.slug)} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Public Profile
                  </a>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-muted/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Lead inbox</div>
                <div className="mt-1 font-medium">{leads.length} total leads{unreadLeads ? `, ${unreadLeads} new` : ''}</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</div>
                <div className="mt-1 font-medium capitalize">{normalized.replace('_', ' ')}</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">What this unlocks</div>
                <div className="mt-1 font-medium">Business profile, leads, placement, and vendor controls</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Review trail</div>
                <div className="mt-1 font-medium">Manual review completed by Accountabul</div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/list-property">
                    List a Property
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/professionals">
                    View marketplace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {vendorProfile?.slug ? (
                  <Button asChild variant="outline">
                    <a href={getVendorPublicUrl(vendorProfile.slug)} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Public Profile
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  <Link to="/vendors/apply">Edit application</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/95 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Building2 className="h-5 w-5 text-primary" />
                  Lead inbox
                </CardTitle>
                <CardDescription>Track new inquiries, mark them contacted, and close them out once handled.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {leadsLoading ? (
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">Loading leads...</div>
                ) : leads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-6 text-center">
                    <MessageCircle className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="font-medium">No leads yet</p>
                    <p className="text-sm text-muted-foreground">When someone contacts your profile, the request will appear here.</p>
                  </div>
                ) : (
                  leads.map((lead) => (
                    <div key={lead.id} className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{lead.requester_name}</p>
                          <p className="text-sm text-muted-foreground">{lead.requester_email}</p>
                        </div>
                        <Badge variant={lead.status === 'new' ? 'secondary' : lead.status === 'contacted' ? 'default' : 'outline'}>
                          {lead.status === 'new' ? 'New' : lead.status === 'contacted' ? 'Contacted' : 'Closed'}
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium">{lead.service_needed}</p>
                        <p className="text-muted-foreground line-clamp-2">{lead.message}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateLeadStatus(lead.id, 'contacted')} disabled={lead.status === 'contacted' || lead.status === 'closed'}>
                          <Clock3 className="mr-2 h-4 w-4" />
                          Mark contacted
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateLeadStatus(lead.id, 'closed')} disabled={lead.status === 'closed'}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Close
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <VendorBenefitsCard
              primaryHref="/vendors/apply"
              primaryLabel="Edit application"
              secondaryHref="/professionals"
              secondaryLabel="Open marketplace"
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
