import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Building2, Loader2, ShieldCheck, Users2 } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VendorBenefitsCard } from '@/components/vendors/VendorBenefitsCard'
import { useVendorApplication } from '@/hooks/useVendorApplication'
import { getVendorNextRoute, normalizeVendorStatus } from '@/lib/vendorFlow'

export default function VendorDashboard() {
  const navigate = useNavigate()
  const { vendorApplication, isLoading, user } = useVendorApplication()

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

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Vendor Dashboard | Accountabul"
        description="Manage your verified vendor profile, marketplace exposure, and business tools on Accountabul."
        path="/vendor/dashboard"
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
              <CardTitle className="text-3xl">Vendor dashboard</CardTitle>
              <CardDescription>
                This is the operational home for approved businesses on Accountabul.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Link to="/professionals">
                    View marketplace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/vendor/status">Application status</Link>
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
                <CardDescription>Use this area as the business-facing control center.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <Users2 className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-medium">Customer leads</p>
                  <p className="text-sm text-muted-foreground">Track interest and inbound requests from members.</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-medium">Trust badge</p>
                  <p className="text-sm text-muted-foreground">Your verified vendor status is visible to members.</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <BadgeCheck className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-medium">Marketplace placement</p>
                  <p className="text-sm text-muted-foreground">Promotions and listing priority live here.</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <Building2 className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-medium">Business profile</p>
                  <p className="text-sm text-muted-foreground">Keep your public company page current.</p>
                </div>
              </CardContent>
            </Card>

            <VendorBenefitsCard
              primaryHref="/vendor/status"
              primaryLabel="Review status"
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
