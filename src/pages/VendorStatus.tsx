import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useVendorApplication } from '@/hooks/useVendorApplication'
import { getVendorNextRoute, getVendorStatusLabel, normalizeVendorStatus } from '@/lib/vendorFlow'

export default function VendorStatus() {
  const navigate = useNavigate()
  const { vendorApplication, isLoading, isVerified, user } = useVendorApplication()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      navigate('/auth?next=/vendor/status', { replace: true })
      return
    }
    const normalized = normalizeVendorStatus(vendorApplication?.status)
    if (normalized === 'none') {
      navigate('/vendor/onboarding', { replace: true })
      return
    }
    if (normalized === 'active') {
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
  const reason = vendorApplication?.rejection_reason ?? null

  const Icon =
    normalized === 'active'
      ? CheckCircle2
      : normalized === 'rejected' || normalized === 'revoked'
        ? XCircle
        : Clock3

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Vendor Application Status | Accountabul"
        description="Check the status of your verified vendor application. Accountabul reviews vendor applications within 24 to 48 hours."
        path="/vendor/status"
        noindex
      />
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            <Badge variant="outline" className="mx-auto w-fit">
              {getVendorStatusLabel(normalized)}
            </Badge>
            <CardTitle className="text-2xl">Vendor application status</CardTitle>
            <CardDescription className="max-w-2xl mx-auto text-base">
              {normalized === 'active'
                ? 'Your vendor credential is active.'
                : normalized === 'rejected'
                  ? 'Your application was reviewed, but it was not approved.'
                  : normalized === 'expired'
                    ? 'Your application expired and needs a fresh submission.'
                    : 'Your paid application is in the review pipeline.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current state</div>
                <div className="mt-1 font-medium capitalize">{normalized.replace('_', ' ')}</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Review window</div>
                <div className="mt-1 font-medium">24 to 48 hours</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Route target</div>
                <div className="mt-1 font-medium">
                  {isVerified ? 'Dashboard' : normalized === 'none' ? 'Apply' : 'Status'}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-5">
              <div className="flex items-center gap-2 font-medium">
                {normalized === 'active' ? (
                  <ShieldCheck className="h-4 w-4 text-primary" />
                ) : normalized === 'rejected' || normalized === 'revoked' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <Clock3 className="h-4 w-4 text-primary" />
                )}
                {normalized === 'active'
                  ? 'Verified vendor access is unlocked.'
                  : 'We are reviewing your application manually.'}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {normalized === 'active'
                  ? 'You can now use the vendor dashboard, business profile, and marketplace tools.'
                  : 'No automatic badge is issued. We confirm the submission and respond after the review process.'}
              </p>
            </div>

            {reason ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <div className="font-medium text-destructive">Review note</div>
                <p className="mt-1 text-muted-foreground">{reason}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {normalized === 'active' ? (
                <Button asChild>
                  <Link to="/vendor/dashboard">
                    Open vendor dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/vendor/onboarding">
                    Return to application
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
              {normalized === 'rejected' || normalized === 'expired' || normalized === 'revoked' ? (
                <Button asChild variant="outline">
                  <Link to="/vendor/onboarding">Reapply</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/vendor">Back to vendor program</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  )
}
