import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Lock, Wallet } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VendorBenefitsCard } from '@/components/vendors/VendorBenefitsCard'
import { useVendorApplication } from '@/hooks/useVendorApplication'
import { useKycStatus } from '@/hooks/useKycStatus'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { useProfile } from '@/hooks/useProfile'
import { useAuth } from '@/hooks/useAuth'
import { getVendorNextRoute, normalizeVendorStatus } from '@/lib/vendorFlow'

export default function VendorOnboarding() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const { isApproved: kycApproved, isLoading: kycLoading } = useKycStatus()
  const { openConnectModal, isConnected, activeAddress } = useActiveWallet()
  const {
    vendorApplication,
    vendorEligibility,
    status,
    isVerified,
    isPendingReview,
    canApply,
    submitVendorApplication,
    isLoading,
  } = useVendorApplication()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authLoading || profileLoading || kycLoading || isLoading) return
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
  }, [
    authLoading,
    profileLoading,
    kycLoading,
    isLoading,
    navigate,
    user,
    vendorApplication?.status,
  ])

  const blockers: string[] = []
  if ((profile?.account_type ?? 'individual') !== 'business') blockers.push('Switch your account type to business.')
  if (!isConnected) blockers.push('Connect the wallet tied to this application.')
  if (!kycApproved) blockers.push('Complete identity verification first.')

  const vendorEligibilityBlockers = vendorEligibility?.blocking_reasons ?? []
  const mergedBlockers = [...new Set([...blockers, ...vendorEligibilityBlockers])]

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await submitVendorApplication()
      toast.success('Vendor application submitted. We will review it within 24 to 48 hours.')
      navigate('/vendor/status', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit vendor application.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Apply to Become a Vendor | Accountabul"
        description="Submit a paid verified vendor application for manual review. Accountabul reviews vendor applications within 24 to 48 hours."
        path="/vendor/onboarding"
        noindex
      />
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
              Verified vendor onboarding
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Submit your business for manual review.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Verified vendors are reviewed by the Accountabul team. Once submitted, you should hear back within 24
                to 48 hours. If approved, you get the vendor credential and the business-facing tools that go with it.
              </p>
            </div>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Lock className="h-5 w-5 text-primary" />
                  What this onboarding covers
                </CardTitle>
                <CardDescription>
                  This is a paid, manually reviewed onboarding flow, not an instant badge generator.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>1. You connect a wallet.</p>
                <p>2. You confirm a business account and KYC status.</p>
                <p>3. We review the application and come back with an answer.</p>
                <p>4. Approved vendors receive a verified vendor credential and dashboard access.</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle className="text-xl">Payment step</CardTitle>
                <CardDescription>
                  If the onboarding fee is handled separately, use the payments rail first and then submit the vendor
                  file for review.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/payments">Open payments</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/pricing">Review membership plans</Link>
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-border/70 bg-card/90">
                <CardContent className="p-4">
                  <Wallet className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-medium">Wallet required</p>
                  <p className="text-sm text-muted-foreground">We attach the review to the wallet you choose.</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card/90">
                <CardContent className="p-4">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-medium">Business account required</p>
                  <p className="text-sm text-muted-foreground">Vendor applications are for businesses only.</p>
                </CardContent>
              </Card>
            </div>

            {mergedBlockers.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Before you submit
                  </CardTitle>
                  <CardDescription>
                    These items need attention before we can accept the vendor file.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {mergedBlockers.map((item) => (
                    <div key={item} className="rounded-lg border border-amber-200 bg-white/70 p-3 dark:border-amber-900/30 dark:bg-background/50">
                      {item}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {!isConnected && (
                      <Button variant="outline" onClick={openConnectModal}>
                        Connect wallet
                      </Button>
                    )}
                    {!kycApproved && (
                      <Button asChild variant="outline">
                        <Link to="/kyc">Complete KYC</Link>
                      </Button>
                    )}
                    {(profile?.account_type ?? 'individual') !== 'business' && (
                      <Button asChild variant="outline">
                        <Link to="/settings">Switch to business account</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || !canApply}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit paid vendor application
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/vendor/status">Check status</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              We will confirm the result by review, not by automatic badge issuance.
            </p>
          </div>

          <div className="space-y-6">
            <VendorBenefitsCard
              primaryHref="/vendor/status"
              primaryLabel="Check status"
              secondaryHref="/vendor"
              secondaryLabel="Back to vendor entry"
            />

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle className="text-xl">Current application snapshot</CardTitle>
                <CardDescription>Status and routing for this account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</div>
                  <div className="mt-1 font-medium capitalize">{status.replace('_', ' ')}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Next step</div>
                  <div className="mt-1 font-medium">
                    {isVerified
                      ? 'Vendor dashboard'
                      : isPendingReview
                        ? 'Vendor status page'
                        : 'Submit application'}
                  </div>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Wallet</div>
                  <div className="mt-1 font-medium">{activeAddress ?? 'Not connected'}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

