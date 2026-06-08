/**
 * AdminCredentials  -  /admin/credentials
 *
 * Tabbed admin view for the credential application lifecycle:
 *   1. New Applications      - status = 'applied'
 *   2. Under Review          - status = 'under_review'
 *   3. Approved / To Issue   - status = 'approved'
 *   4. Issued / Awaiting     - status = 'issued_pending_acceptance'
 *   5. Active Credentials    - status = 'active'
 *   6. Expired               - status = 'expired'
 *   7. Issuer & Ledger       - IssuerWalletPanel + CredentialLedgerPanel
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldCheck, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'
import { useTeamAccess } from '@/hooks/useTeamAccess'
import { IssuerWalletPanel } from '@/components/admin/IssuerWalletPanel'
import { PendingRegistrationsPanel } from '@/components/admin/PendingRegistrationsPanel'
import { CredentialLedgerPanel } from '@/components/admin/CredentialLedgerPanel'
import { CredentialEvidencePanel } from '@/components/admin/CredentialEvidencePanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { callEdgeFunction } from '@/lib/edgeFunction'
import { callAdminEdgeFunction } from '@/lib/adminEdge'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminApplication {
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
  revocation_reason: string | null
  notes: string | null
  wallet_credential_id: string | null
  credential_catalog: {
    credential_name: string
  } | null
  _profile_name?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function userName(app: AdminApplication): string {
  if (app._profile_name) return app._profile_name
  return app.user_id.slice(0, 8) + '...'
}

function shortWallet(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null
  const hoursLeft = (new Date(expiresAt).getTime() - Date.now()) / 3_600_000
  let className = 'text-green-600 dark:text-green-400'
  if (hoursLeft < 1) className = 'text-red-600 dark:text-red-400'
  else if (hoursLeft < 6) className = 'text-orange-500 dark:text-orange-400'
  else if (hoursLeft < 24) className = 'text-yellow-600 dark:text-yellow-400'
  return (
    <span className={`text-xs font-medium ${className}`}>
      {hoursLeft <= 0 ? 'Expired' : `${Math.floor(hoursLeft)}h left`}
    </span>
  )
}

// ─── Application Row ─────────────────────────────────────────────────────────

interface AppRowProps {
  app: AdminApplication
  actions: React.ReactNode
}

function AppRow({ app, actions }: AppRowProps) {
  return (
    <Card className="mb-3">
      <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{app.credential_catalog?.credential_name ?? app.credential_key}</span>
            <Badge variant="secondary" className="text-xs">{app.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            User: {userName(app)} - Wallet: {shortWallet(app.wallet_address)}
          </p>
          <p className="text-xs text-muted-foreground">
            Applied: {new Date(app.applied_at).toLocaleString()}
          </p>
          {app.rejection_reason && (
            <p className="text-xs text-red-500">Rejection: {app.rejection_reason}</p>
          )}
          {app.expires_at && <ExpiryBadge expiresAt={app.expires_at} />}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminCredentials = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: accessLoading } = useTeamAccess()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState('new')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [evidenceOpenId, setEvidenceOpenId] = useState<string | null>(null)

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<AdminApplication | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Revoke dialog state
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<AdminApplication | null>(null)
  const [revokeReason, setRevokeReason] = useState('')

  useEffect(() => {
    if (authLoading || accessLoading) return
    if (!user) { navigate('/auth'); return }
    if (!hasAccess) navigate('/dashboard')
  }, [user, authLoading, hasAccess, accessLoading, navigate])

  // Fetch all applications (admin view)
  const { data: allApps = [], isLoading: appsLoading, refetch } = useQuery<AdminApplication[]>({
    queryKey: ['admin-credential-applications'],
    queryFn: async () => {
      const data = await callAdminEdgeFunction('admin-credential-applications', { action: 'list' })
      return (data.applications ?? []) as AdminApplication[]
    },
    enabled: !!user && !!hasAccess,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!hasAccess) return null

  // Partition by status
  const newApps = allApps.filter((a) => a.status === 'applied')
  const reviewingApps = allApps.filter((a) => a.status === 'under_review')
  const approvedApps = allApps.filter((a) => a.status === 'approved')
  const issuedApps = allApps.filter((a) => a.status === 'issued_pending_acceptance')
  const activeApps = allApps.filter((a) => a.status === 'active')
  const expiredApps = allApps.filter((a) => a.status === 'expired')

  async function runAction(appId: string, action: string, extra?: Record<string, unknown>) {
    setActionLoading(appId + action)
    try {
      await callEdgeFunction('review-credential-application', { application_id: appId, action, ...extra })
      toast.success(`Action '${action}' completed`)
      qc.invalidateQueries({ queryKey: ['admin-credential-applications'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function runIssueCredential(appId: string) {
    setActionLoading(appId + 'issue_cred')
    try {
      const result = await callEdgeFunction<{ message?: string }>('issue-credential', { application_id: appId })
      toast.success(result.message ?? 'Credential issued')
      qc.invalidateQueries({ queryKey: ['admin-credential-applications'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Issue failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function runRevoke(appId: string, reason: string) {
    setActionLoading(appId + 'revoke')
    try {
      await callEdgeFunction('revoke-credential', { application_id: appId, reason })
      toast.success('Credential revoked')
      qc.invalidateQueries({ queryKey: ['admin-credential-applications'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revoke failed')
    } finally {
      setActionLoading(null)
      setRevokeDialogOpen(false)
      setRevokeTarget(null)
      setRevokeReason('')
    }
  }

  function ActionButton({
    appId,
    actionKey,
    label,
    variant = 'default',
    onClick,
  }: {
    appId: string
    actionKey: string
    label: string
    variant?: 'default' | 'outline' | 'destructive'
    onClick: () => void
  }) {
    const loading = actionLoading === appId + actionKey
    return (
      <Button size="sm" variant={variant} disabled={!!actionLoading} onClick={onClick}>
        {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
        {label}
      </Button>
    )
  }

  function tabLabel(label: string, count: number) {
    return (
      <span className="flex items-center gap-1.5">
        {label}
        {count > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full text-xs px-1.5 py-0.5 leading-none">
            {count}
          </span>
        )}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Credential Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage credential applications, issuance, and revocation
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={appsLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${appsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
            <TabsTrigger value="new">{tabLabel('New', newApps.length)}</TabsTrigger>
            <TabsTrigger value="reviewing">{tabLabel('Reviewing', reviewingApps.length)}</TabsTrigger>
            <TabsTrigger value="approved">{tabLabel('Approved', approvedApps.length)}</TabsTrigger>
            <TabsTrigger value="issued">{tabLabel('Issued', issuedApps.length)}</TabsTrigger>
            <TabsTrigger value="active">{tabLabel('Active', activeApps.length)}</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
            <TabsTrigger value="ledger">Issuer & Ledger</TabsTrigger>
          </TabsList>

          {/* ── New Applications ─────────────────────────────────────────── */}
          <TabsContent value="new">
            <CardTitle className="text-base mb-4">New Applications</CardTitle>
            {appsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : newApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No new applications.</p>
            ) : (
              newApps.map((app) => (
                <AppRow
                  key={app.id}
                  app={app}
                  actions={
                    <ActionButton
                      appId={app.id}
                      actionKey="start_review"
                      label="Start Review"
                      variant="outline"
                      onClick={() => runAction(app.id, 'start_review')}
                    />
                  }
                />
              ))
            )}
          </TabsContent>

          {/* ── Under Review ─────────────────────────────────────────────── */}
          <TabsContent value="reviewing">
            <CardTitle className="text-base mb-4">Under Review</CardTitle>
            {appsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : reviewingApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications under review.</p>
            ) : (
              reviewingApps.map((app) => {
                const evidenceOpen = evidenceOpenId === app.id
                return (
                  <div key={app.id} className="mb-3">
                    <AppRow
                      app={app}
                      actions={
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEvidenceOpenId(evidenceOpen ? null : app.id)}
                          >
                            {evidenceOpen
                              ? <><ChevronUp className="w-3 h-3 mr-1" />Hide Evidence</>
                              : <><ChevronDown className="w-3 h-3 mr-1" />View Evidence</>
                            }
                          </Button>
                          <ActionButton
                            appId={app.id}
                            actionKey="approve"
                            label="Approve"
                            onClick={() => runAction(app.id, 'approve')}
                          />
                          <ActionButton
                            appId={app.id}
                            actionKey="reject"
                            label="Reject"
                            variant="destructive"
                            onClick={() => {
                              setRejectTarget(app)
                              setRejectReason('')
                              setRejectDialogOpen(true)
                            }}
                          />
                        </>
                      }
                    />
                    {evidenceOpen && (
                      <Card className="mt-1 mb-1 border-dashed">
                        <CardContent className="pt-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            Submitted Evidence - {app.credential_catalog?.credential_name ?? app.credential_key}
                          </p>
                          <CredentialEvidencePanel
                            applicationId={app.id}
                            credentialKey={app.credential_key}
                            userId={app.user_id}
                          />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )
              })
            )}
          </TabsContent>

          {/* ── Approved / Ready to Issue ─────────────────────────────────── */}
          <TabsContent value="approved">
            <CardTitle className="text-base mb-4">Approved - Ready to Issue</CardTitle>
            {appsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : approvedApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approved applications awaiting issuance.</p>
            ) : (
              approvedApps.map((app) => (
                <AppRow
                  key={app.id}
                  app={app}
                  actions={
                    <ActionButton
                      appId={app.id}
                      actionKey="issue"
                      label="Issue Credential"
                      onClick={() => runAction(app.id, 'issue')}
                    />
                  }
                />
              ))
            )}
          </TabsContent>

          {/* ── Issued / Awaiting Acceptance ──────────────────────────────── */}
          <TabsContent value="issued">
            <CardTitle className="text-base mb-4">Issued - Awaiting User Acceptance</CardTitle>
            {appsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : issuedApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No credentials awaiting acceptance.</p>
            ) : (
              issuedApps.map((app) => (
                <AppRow
                  key={app.id}
                  app={app}
                  actions={
                    <ActionButton
                      appId={app.id}
                      actionKey="issue_cred"
                      label="Reissue"
                      variant="outline"
                      onClick={() => runIssueCredential(app.id)}
                    />
                  }
                />
              ))
            )}
          </TabsContent>

          {/* ── Active Credentials ───────────────────────────────────────── */}
          <TabsContent value="active">
            <CardTitle className="text-base mb-4">Active Credentials</CardTitle>
            {appsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : activeApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active credentials.</p>
            ) : (
              activeApps.map((app) => (
                <AppRow
                  key={app.id}
                  app={app}
                  actions={
                    <ActionButton
                      appId={app.id}
                      actionKey="revoke"
                      label="Revoke"
                      variant="destructive"
                      onClick={() => {
                        setRevokeTarget(app)
                        setRevokeReason('')
                        setRevokeDialogOpen(true)
                      }}
                    />
                  }
                />
              ))
            )}
          </TabsContent>

          {/* ── Expired ─────────────────────────────────────────────────── */}
          <TabsContent value="expired">
            <CardTitle className="text-base mb-4">Expired Credentials</CardTitle>
            {appsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : expiredApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expired credentials.</p>
            ) : (
              expiredApps.map((app) => (
                <AppRow
                  key={app.id}
                  app={app}
                  actions={
                    <ActionButton
                      appId={app.id}
                      actionKey="issue_cred"
                      label="Reissue"
                      variant="outline"
                      onClick={() => runIssueCredential(app.id)}
                    />
                  }
                />
              ))
            )}
          </TabsContent>

          {/* ── Issuer & Ledger ──────────────────────────────────────────── */}
          <TabsContent value="ledger">
            <div className="space-y-6">
              <IssuerWalletPanel />
              <PendingRegistrationsPanel />
              <CredentialLedgerPanel />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Reject Dialog ───────────────────────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejecting{' '}
              <strong>{rejectTarget?.credential_catalog?.credential_name ?? rejectTarget?.credential_key}</strong>{' '}
              for {rejectTarget ? userName(rejectTarget) : ''}:
            </p>
            <textarea
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={4}
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || !!actionLoading}
              onClick={async () => {
                if (!rejectTarget) return
                await runAction(rejectTarget.id, 'reject', { rejection_reason: rejectReason.trim() })
                setRejectDialogOpen(false)
                setRejectTarget(null)
                setRejectReason('')
              }}
            >
              {actionLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke Dialog ───────────────────────────────────────────────── */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Credential</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Provide a reason for revoking{' '}
              <strong>{revokeTarget?.credential_catalog?.credential_name ?? revokeTarget?.credential_key}</strong>{' '}
              for {revokeTarget ? userName(revokeTarget) : ''}:
            </p>
            <textarea
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={4}
              placeholder="Reason for revocation..."
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!revokeReason.trim() || !!actionLoading}
              onClick={() => {
                if (!revokeTarget) return
                runRevoke(revokeTarget.id, revokeReason.trim())
              }}
            >
              {actionLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Revoke Credential
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}

export default AdminCredentials
