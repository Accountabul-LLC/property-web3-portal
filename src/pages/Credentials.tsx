import React, { useState, useEffect } from 'react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { useKycStatus } from '@/hooks/useKycStatus'
import { useCredentialApplications, CredentialApplication } from '@/hooks/useCredentialApplications'
import { useCredentialCatalog } from '@/hooks/useCredentialCatalog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

// ─── Countdown Timer ────────────────────────────────────────────────────────

interface CountdownTimerProps {
  expiresAt: string
}

function CountdownTimer({ expiresAt }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    function calc() {
      const diff = new Date(expiresAt).getTime() - Date.now()
      setRemaining(Math.max(0, diff))
    }
    calc()
    const interval = setInterval(calc, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  const totalSeconds = Math.floor(remaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => String(n).padStart(2, '0')

  let colorClass = 'text-green-600 dark:text-green-400'
  if (hours < 1) colorClass = 'text-red-600 dark:text-red-400'
  else if (hours < 6) colorClass = 'text-orange-500 dark:text-orange-400'
  else if (hours < 24) colorClass = 'text-yellow-600 dark:text-yellow-400'

  if (remaining <= 0) {
    return <span className="text-xs text-red-600 dark:text-red-400 font-mono">Expired</span>
  }

  return (
    <span className={`text-xs font-mono font-semibold ${colorClass}`}>
      {pad(hours)}h {pad(minutes)}m {pad(seconds)}s remaining
    </span>
  )
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    applied: { label: 'Applied', variant: 'secondary' },
    under_review: { label: 'Under Review', variant: 'secondary' },
    approved: { label: 'Approved', variant: 'outline' },
    issued_pending_acceptance: { label: 'Awaiting Acceptance', variant: 'outline' },
    active: { label: 'Active', variant: 'default' },
    expired: { label: 'Expired', variant: 'destructive' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    revoked: { label: 'Revoked', variant: 'destructive' },
    draft: { label: 'Draft', variant: 'secondary' },
  }
  const entry = map[status] ?? { label: status, variant: 'secondary' as const }
  return <Badge variant={entry.variant}>{entry.label}</Badge>
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const Credentials = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { activeAddress, isConnected } = useActiveWallet()
  const { isApproved: kycApproved, isLoading: kycLoading } = useKycStatus()
  const { applications, isLoading: appsLoading, refetch } = useCredentialApplications()
  const { eligibleCatalog, isLoading: catalogLoading } = useCredentialCatalog()

  const [applyingFor, setApplyingFor] = useState<string | null>(null)
  const [acceptingFor, setAcceptingFor] = useState<string | null>(null)

  const { applyForCredential } = useCredentialApplications()

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth')
    }
  }, [user, authLoading, navigate])

  if (authLoading || kycLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  // Partition applications by status group
  const underReview = applications.filter((a) =>
    ['applied', 'under_review', 'approved'].includes(a.status)
  )
  const readyToAccept = applications.filter((a) => a.status === 'issued_pending_acceptance')
  const active = applications.filter((a) => a.status === 'active')
  const expired = applications.filter((a) => a.status === 'expired')
  const rejected = applications.filter((a) => a.status === 'rejected')

  // Keys that already have a non-terminal application
  const appliedKeys = new Set(
    applications
      .filter((a) => !['rejected', 'expired', 'revoked'].includes(a.status))
      .map((a) => a.credential_key)
  )

  const availableToApply = eligibleCatalog.filter((c) => !appliedKeys.has(c.credential_key))

  async function handleApply(credential_key: string) {
    if (!activeAddress) {
      toast.error('Connect your wallet before applying')
      return
    }
    if (!kycApproved) {
      toast.error('KYC verification must be approved before applying')
      navigate('/kyc/status')
      return
    }
    setApplyingFor(credential_key)
    try {
      await applyForCredential(credential_key, activeAddress)
      toast.success('Application submitted successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setApplyingFor(null)
    }
  }

  async function handleAccept(app: CredentialApplication) {
    if (!app.wallet_credential_id) {
      toast.error('No credential ID linked to this application')
      return
    }
    setAcceptingFor(app.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/credential-accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ credential_id: app.wallet_credential_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      toast.success('Credential accepted successfully')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept credential')
    } finally {
      setAcceptingFor(null)
    }
  }

  const isLoading = appsLoading || catalogLoading

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Credentials</h1>
            <p className="text-sm text-muted-foreground">
              Apply for and manage your on-chain credentials for platform access
            </p>
          </div>
        </div>

        {/* Wallet warning */}
        {!isConnected && (
          <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4 flex items-center gap-3">
              <Wallet className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Connect your wallet to apply for credentials and track acceptance.
              </p>
            </CardContent>
          </Card>
        )}

        {/* KYC warning */}
        {!kycApproved && (
          <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Identity verification required before applying for credentials.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/kyc')}>
                Verify Now
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Available to Apply */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Available to Apply
              </h2>
              {availableToApply.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No new credentials available for your account type, or all eligible credentials have active applications.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {availableToApply.map((entry) => (
                    <Card key={entry.credential_key}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{entry.credential_name}</CardTitle>
                        <CardDescription className="text-xs">{entry.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 flex items-center justify-between">
                        <div className="flex gap-1 flex-wrap">
                          {entry.requires_kyc && (
                            <Badge variant="outline" className="text-xs">KYC Required</Badge>
                          )}
                          {entry.requires_wallet && (
                            <Badge variant="outline" className="text-xs">Wallet Required</Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          disabled={applyingFor === entry.credential_key || !isConnected || !kycApproved}
                          onClick={() => handleApply(entry.credential_key)}
                        >
                          {applyingFor === entry.credential_key ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : null}
                          Apply
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Ready to Accept */}
            {readyToAccept.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Ready to Accept
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {readyToAccept.map((app) => (
                    <Card key={app.id} className="border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {app.credential_catalog?.credential_name ?? app.credential_key}
                          </CardTitle>
                          <StatusBadge status={app.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        {app.expires_at && <CountdownTimer expiresAt={app.expires_at} />}
                        <p className="text-xs text-muted-foreground">
                          Wallet: {app.wallet_address.slice(0, 8)}...{app.wallet_address.slice(-6)}
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={acceptingFor === app.id || !isConnected}
                          onClick={() => handleAccept(app)}
                        >
                          {acceptingFor === app.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : null}
                          Accept Credential
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Under Review */}
            {underReview.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  Under Review
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {underReview.map((app) => (
                    <Card key={app.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {app.credential_catalog?.credential_name ?? app.credential_key}
                          </CardTitle>
                          <StatusBadge status={app.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Applied: {new Date(app.applied_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Wallet: {app.wallet_address.slice(0, 8)}...{app.wallet_address.slice(-6)}
                        </p>
                        {app.status === 'approved' && (
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Approved — awaiting issuance by Accountabul
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Active */}
            {active.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Active Credentials
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {active.map((app) => (
                    <Card key={app.id} className="border-green-200 dark:border-green-800">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {app.credential_catalog?.credential_name ?? app.credential_key}
                          </CardTitle>
                          <StatusBadge status={app.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-1">
                        {app.accepted_at && (
                          <p className="text-xs text-muted-foreground">
                            Accepted: {new Date(app.accepted_at).toLocaleDateString()}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Wallet: {app.wallet_address.slice(0, 8)}...{app.wallet_address.slice(-6)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Expired */}
            {expired.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                  Expired
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {expired.map((app) => (
                    <Card key={app.id} className="opacity-80">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {app.credential_catalog?.credential_name ?? app.credential_key}
                          </CardTitle>
                          <StatusBadge status={app.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Issued credential expired before acceptance.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={applyingFor === app.credential_key || !isConnected || !kycApproved}
                          onClick={() => handleApply(app.credential_key)}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reapply
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Rejected */}
            {rejected.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  Rejected
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {rejected.map((app) => (
                    <Card key={app.id} className="border-red-200 dark:border-red-900 opacity-80">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {app.credential_catalog?.credential_name ?? app.credential_key}
                          </CardTitle>
                          <StatusBadge status={app.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        {app.rejection_reason && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            Reason: {app.rejection_reason}
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={applyingFor === app.credential_key || !isConnected || !kycApproved}
                          onClick={() => handleApply(app.credential_key)}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reapply
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {applications.length === 0 && availableToApply.length === 0 && (
              <div className="text-center py-16">
                <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No credentials available for your account type.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default Credentials
