import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Building2, ShieldCheck, Star } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const benefits = [
  'Business profile and marketplace visibility',
  'Verified vendor badge after manual review',
  'Customer leads and vendor-network exposure',
  'Business-facing tools and trust credentials',
]

export default function Vendor() {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Verified Vendors | Accountabul"
        description="Join the Accountabul verified vendor network, submit your business for review, and unlock marketplace visibility after approval."
        path="/vendor"
      />
      <Navigation />

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/70 bg-card/95 shadow-card">
            <CardHeader>
              <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                <Star className="mr-2 h-3.5 w-3.5" />
                Verified vendor network
              </Badge>
              <CardTitle className="text-3xl">Join as a verified vendor</CardTitle>
              <CardDescription>
                Accountabul reviews vendor requests manually. If approved, your business gets the verified vendor badge
                and the tools that go with it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <div key={benefit} className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
                    <BadgeCheck className="mb-2 h-4 w-4 text-primary" />
                    {benefit}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg">
                  <Link to="/auth/vendor">
                    Start vendor sign-up
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/vendor/onboarding">Continue vendor onboarding</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/95 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Building2 className="h-5 w-5 text-primary" />
                  What vendors receive
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>• Business profile and marketplace placement</p>
                <p>• Verified badge after manual review</p>
                <p>• Customer leads and trust visibility</p>
                <p>• Business-only tools and controls</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Review process
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>1. Sign up as a vendor.</p>
                <p>2. Complete onboarding and business verification.</p>
                <p>3. Our team reviews the request manually.</p>
                <p>4. Approved vendors receive the verified badge and dashboard access.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
