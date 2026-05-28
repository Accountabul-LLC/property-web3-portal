import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { VendorBenefitsCard } from '@/components/vendors/VendorBenefitsCard'
import { useVendorApplication } from '@/hooks/useVendorApplication'
import { getVendorNextRoute, normalizeVendorStatus } from '@/lib/vendorFlow'
import { Building2, CalendarClock, ShieldCheck, Users2 } from 'lucide-react'

export default function Vendor() {
  const navigate = useNavigate()
  const { vendorApplication, isLoading, user } = useVendorApplication()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      navigate('/auth?next=/vendor/onboarding', { replace: true })
      return
    }
    const normalized = normalizeVendorStatus(vendorApplication?.status)
    if (normalized === 'active') {
      navigate(getVendorNextRoute(normalized), { replace: true })
      return
    }
    if (normalized !== 'none' && normalized !== 'unknown') {
      navigate(getVendorNextRoute(normalized), { replace: true })
    }
  }, [isLoading, navigate, user, vendorApplication?.status])

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Verified Vendors | Accountabul"
        description="Apply to become a verified vendor on Accountabul. Paid, manually reviewed applications are typically answered within 24 to 48 hours."
        path="/vendor"
      />
      <Navigation />

      <main className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(255,255,255,0.96))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,0.98),_rgba(2,6,23,0.94))]" />

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="space-y-6">
              <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                <Building2 className="mr-2 h-3.5 w-3.5" />
                Verified vendor onboarding
              </Badge>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Become a verified vendor on Accountabul.
                </h1>
                <p className="max-w-2xl text-lg text-muted-foreground">
                  This is the public entry point for businesses and service providers who want a business profile,
                  marketplace exposure, and verified routing inside the platform.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-border/70 bg-card/90">
                  <CardContent className="p-4">
                    <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
                    <p className="font-medium">Manual review</p>
                    <p className="text-sm text-muted-foreground">No auto-badge. We verify each business first.</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/90">
                  <CardContent className="p-4">
                    <CalendarClock className="mb-2 h-5 w-5 text-primary" />
                    <p className="font-medium">24 to 48 hours</p>
                    <p className="text-sm text-muted-foreground">That is the expected window for a first reply.</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/90">
                  <CardContent className="p-4">
                    <Users2 className="mb-2 h-5 w-5 text-primary" />
                    <p className="font-medium">Business routing</p>
                    <p className="text-sm text-muted-foreground">Verified vendors unlock the right marketplace paths.</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/vendor/onboarding">Start vendor onboarding</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/vendor/status">Check application status</Link>
                </Button>
              </div>
            </div>

            <VendorBenefitsCard
              primaryHref="/vendor/onboarding"
              primaryLabel="Start vendor onboarding"
              secondaryHref="/vendor/status"
              secondaryLabel="Check status"
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

