import React, { useState, useEffect } from 'react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { useKycStatus } from '@/hooks/useKycStatus'
import {
  useCredentialEligibility,
  CredentialEligibilityResult,
} from '@/hooks/useCredentialEligibility'
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
  Zap,
  FileText,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Countdown Timer ─────────────────────────────────────────────────────────

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('')
  const [urgency, setUrgency] = useState<'green' | 'yellow' | 'orange' | 'red'>('green')

  useEffect(() => {
    function tick() {
      const ms = new Date(expiresAt).getTime() - Date.now()
      if (ms <= 0) { setRemaining('Expired'); setUrgency('red'); return }
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setRemaining(`${h}h ${m}m ${s}s`)
      setUrgency(h > 24 ? 'green' : h > 12 ? 'yellow' : h > 6 ? 'orange' : 'red')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const colors = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
  }

  return <span className={`font-mono font-medium ${colors[urgency]}`}>{remaining}</span>
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Active', variant: 'outline' },
    issued_pending_acceptance: { label: 'Pending Acceptance', variant: 'default' },
    approved: { label: 'Approved', variant: 'secondary' },
    under_review: { label: 'Under Review', variant: 'secondary' },
    applied: { label: 'Applied', variant: 'secondary' },
    expired: { label: 'Expired', variant: 'destructive' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    revoked: { label: 'Revoked', variant: 'destructive' },
  }
  const entry = map[status] ?? { label: status, variant: 'secondary' as const }
  return <Badge variant={entry.variant}>{entry.label}</Badge>
}

// ─── Requirements Checklist ───────────────────────────────────────────────────

function RequirementsChecklist({ cred }: { cred: CredentialEligibilityResult }) {
  return (
    <ul className="space-y-1.5 mt-2">
      {cred.requirements.map((req) => (
        <li key={req.requirement_key} className="flex items-start gap-2 text-sm">
          {req.met ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <span className={req.met ? 'text-muted-foreground line-through' : ''}>
            {req.display_label}
          </span>
          {!req.met && req.display_hint && (
            <span className="text-xs text-muted-foreground ml-1">— {req.display_hint}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Credentials = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { activeAddress, isConnected } = useActiveWallet()
  const { isApproved: kycApproved, isLoading: kycLoading } = useKycStatus()
  const {
    sections,
    isLoading,
    forceRefresh,
    triggerAutoIssue,
    applyForCredential,
    acceptCredential,
  } = useCredentialEligibility(activeAddress ?? null)

  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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

  async function handleAutoIssue(credential_key: string) {
    setActionInProgress(credential_key)
    try {
      await triggerAutoIssue(credential_key)
      toast.success('Credential issued — check Ready to Accept section')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to issue credential')
    } finally {
      setActionInProgress(null)
    }
  }

  async function handleApply(credential_key: string) {
    setActionInProgress(credential_key)
    try {
      await applyForCredential(credential_key)
      toast.success('Application submitted successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setActionInProgress(null)
    }
  }

  async function handleAccept(wallet_credential_id: string | null, credential_key: string) {
    if (!wallet_credential_id) {
      toast.error('No credential ID linked to this application')
      return
    }
    setActionInProgress(credential_key)
    try {
      await acceptCredential(wallet_credential_id)
      toast.success('Credential accepted successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept credential')
    } finally {
      setActionInProgress(null)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await forceRefresh()
      toast.success('Eligibility refreshed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const totalCredentials =
    sections.active.length +
    sections.ready_to_accept.length +
    sections.auto_issuable.length +
    sections.eligible_apply.length +
    sections.needs_more_info.length +
    sections.unavailable.length

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Credentials</h1>
              <p className="text-sm text-muted-foreground">
                Manage your on-chain credentials, including verified vendor status
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || !activeAddress}
          >
            {refreshing ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Refresh
          </Button>
        </div>

        {/* Wallet warning */}
        {!isConnected && (
          <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4 flex items-center gap-3">
              <Wallet className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Connect your wallet to view and manage credentials.
              </p>
            </CardContent>
          </Card>
        )}

        {/* KYC warning */}
        {isConnected && !kycApproved && (
          <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Identity verification required before vendor or trading credentials can be issued.
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
        ) : totalCredentials === 0 && isConnected ? (
          <div className="text-center py-16">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No credentials available for your account type.</p>
          </div>
        ) : (
          <div className="space-y-10">

            {/* ── Section 1: Active Credentials ── */}
            {sections.active.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Active Credentials
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sections.active.map((cred) => {
                    const app = cred.existing_application
                    return (
                      <Card key={cred.credential_key} className="border-green-200 dark:border-green-800">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{cred.credential_name}</CardTitle>
                            {app && <StatusBadge status={app.status} />}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-1">
                          {app?.status === 'applied' && (
                            <p className="text-xs text-muted-foreground">Application submitted — awaiting review.</p>
                          )}
                          {app?.status === 'under_review' && (
                            <p className="text-xs text-muted-foreground">Under review by our compliance team.</p>
                          )}
                          {app?.status === 'approved' && (
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                              Approved — awaiting issuance.
                            </p>
                          )}
                          {app?.status === 'active' && (
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                              Credential active on XRPL.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Section 2: Ready to Accept ── */}
            {sections.ready_to_accept.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Ready to Accept
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sections.ready_to_accept.map((cred) => {
                    const app = cred.existing_application
                    const inProgress = actionInProgress === cred.credential_key
                    return (
                      <Card key={cred.credential_key} className="border-blue-200 dark:border-blue-800">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{cred.credential_name}</CardTitle>
                            {app && <StatusBadge status={app.status} />}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          {app?.expires_at && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              Expires in: <CountdownTimer expiresAt={app.expires_at} />
                            </div>
                          )}
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={inProgress || !isConnected}
                            onClick={() => handleAccept(app?.wallet_credential_id ?? null, cred.credential_key)}
                          >
                            {inProgress ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                            Accept Credential
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Section 3a: Available Now — Instant Access (Class A) ── */}
            {sections.auto_issuable.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Available Now
                </h2>
                <p className="text-sm text-muted-foreground mb-3">Instant Access — you qualify now, no review required.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sections.auto_issuable.map((cred) => {
                    const inProgress = actionInProgress === cred.credential_key
                    return (
                      <Card key={cred.credential_key} className="border-primary/30 bg-primary/5">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{cred.credential_name}</CardTitle>
                            <Badge variant="outline" className="text-xs border-primary text-primary">Instant</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={inProgress || !isConnected}
                            onClick={() => handleAutoIssue(cred.credential_key)}
                          >
                            {inProgress ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                            Get Credential
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Section 3b: Available Now — Apply (Class B, all docs on file) ── */}
            {sections.eligible_apply.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Apply
                </h2>
                <p className="text-sm text-muted-foreground mb-3">Documents on file — admin review required.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sections.eligible_apply.map((cred) => {
                    const inProgress = actionInProgress === cred.credential_key
                    return (
                      <Card key={cred.credential_key}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{cred.credential_name}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            disabled={inProgress || !isConnected || !kycApproved}
                            onClick={() => handleApply(cred.credential_key)}
                          >
                            {inProgress ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                            Apply
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Section 4: Needs More Information ── */}
            {sections.needs_more_info.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5 text-yellow-500" />
                  Needs More Information
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sections.needs_more_info.map((cred) => (
                    <Card key={cred.credential_key} className="border-yellow-200 dark:border-yellow-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{cred.credential_name}</CardTitle>
                        {cred.blocking_reasons.length > 0 && (
                          <CardDescription className="text-xs">
                            Complete requirements to unlock
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <RequirementsChecklist cred={cred} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* ── Section 5: Not Available ── */}
            {sections.unavailable.length > 0 && (
              <section>
                <details className="group">
                  <summary className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2 select-none list-none">
                    <XCircle className="w-4 h-4" />
                    Not Available for Your Account Type ({sections.unavailable.length})
                    <span className="ml-1 group-open:hidden">▶</span>
                    <span className="ml-1 hidden group-open:inline">▼</span>
                  </summary>
                  <div className="grid gap-2 sm:grid-cols-2 mt-3">
                    {sections.unavailable.map((cred) => (
                      <Card key={cred.credential_key} className="opacity-50">
                        <CardHeader className="pb-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm text-muted-foreground">{cred.credential_name}</CardTitle>
                            <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-xs text-muted-foreground">Not available for your account type.</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </details>
              </section>
            )}

          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default Credentials
