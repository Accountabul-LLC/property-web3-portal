/**
 * WalletRegistrationPanel
 *
 * Displays the Phase 1A compliance steps for a connected wallet and lets the user
 * take actions at each step. Designed to be embedded in the Dashboard or a
 * dedicated /compliance page.
 *
 * Steps:
 *   1. Authenticated           — always satisfied if this component renders
 *   2. KYC Approved            — redirect to /kyc if not done
 *   3. Wallet Connected        — reflects ActiveWalletContext
 *   4. Registration Requested  — calls wallet-register
 *   5. Credential Issued       — admin action, shows pending state
 *   6. Credential Accepted     — calls credential-accept; completes the flow
 */

import { useState } from 'react'
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useWalletCompliance, WalletComplianceState } from '@/hooks/useWalletCompliance'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'

type StepStatus = 'done' | 'pending' | 'action' | 'waiting' | 'error'

interface Step {
  id: string
  label: string
  description: string
  status: StepStatus
}

function buildSteps(state: WalletComplianceState | null | undefined): Step[] {
  const kyc = state?.kyc_status ?? 'not_started'
  const wallet = state?.wallet_status ?? 'not_found'
  const reg = state?.registration_status ?? 'not_started'
  const cred = state?.credential_status ?? 'none'

  const kycDone = kyc === 'approved'
  const walletDone = wallet === 'active'
  const regDone = reg === 'approved'
  const credIssued = cred === 'issued'
  const credAccepted = cred === 'accepted'

  function regStatus(): StepStatus {
    if (regDone) return 'done'
    if (reg === 'pending' || reg === 'under_review') return 'waiting'
    if (reg === 'rejected' || reg === 'revoked') return 'error'
    if (kycDone && walletDone) return 'action'
    return 'pending'
  }

  function credIssueStatus(): StepStatus {
    if (credIssued || credAccepted) return 'done'
    if (cred === 'failed') return 'error'
    if (regDone) return 'waiting'
    return 'pending'
  }

  function credAcceptStatus(): StepStatus {
    if (credAccepted && state?.is_trade_enabled) return 'done'
    if (cred === 'failed') return 'error'
    if (credIssued) return 'action'
    return 'pending'
  }

  return [
    {
      id: 'kyc',
      label: 'Identity Verified',
      description: kyc === 'approved'
        ? 'KYC approved.'
        : kyc === 'submitted' || kyc === 'under_review'
        ? 'Your application is under review.'
        : 'Complete identity verification to continue.',
      status: kycDone ? 'done' : (kyc === 'submitted' || kyc === 'under_review') ? 'waiting' : 'action',
    },
    {
      id: 'wallet',
      label: 'Wallet Connected',
      description: walletDone
        ? 'Wallet is active and linked to your account.'
        : 'Connect a wallet via Xaman.',
      status: walletDone ? 'done' : kycDone ? 'action' : 'pending',
    },
    {
      id: 'registration',
      label: 'Trade Registration',
      description:
        reg === 'approved' ? 'Registration approved by compliance.'
        : reg === 'pending' ? 'Pending compliance review — we\'ll notify you when approved.'
        : reg === 'under_review' ? 'Under compliance review.'
        : reg === 'rejected' ? 'Registration was rejected. You may re-apply.'
        : reg === 'revoked' ? 'Registration has been revoked. Contact support.'
        : 'Request to register this wallet for trading.',
      status: regStatus(),
    },
    {
      id: 'credential_issued',
      label: 'XRPL Credential Issued',
      description:
        credIssued || credAccepted
          ? 'Platform has issued your trading credential on the XRP Ledger.'
          : regDone
          ? 'Waiting for the platform to issue your credential — this is usually automatic.'
          : 'Issued after registration is approved.',
      status: credIssueStatus(),
    },
    {
      id: 'credential_accept',
      label: 'Credential Accepted',
      description:
        credAccepted
          ? 'You have accepted the credential on-ledger. Wallet is trade-enabled.'
          : credIssued
          ? 'Accept the credential with your wallet to become trade-enabled.'
          : 'Requires credential to be issued first.',
      status: credAcceptStatus(),
    },
  ]
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    case 'waiting':
      return <Clock className="h-5 w-5 text-yellow-500" />
    case 'action':
      return <Circle className="h-5 w-5 text-blue-500" />
    case 'error':
      return <AlertCircle className="h-5 w-5 text-red-500" />
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />
  }
}

export function WalletRegistrationPanel() {
  const { activeWallet } = useActiveWallet()
  const { data: compliance, isLoading, refetch } = useWalletCompliance(activeWallet?.address)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const steps = buildSteps(compliance)

  async function getAuthHeader(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? `Bearer ${session.access_token}` : null
  }

  async function callEdgeFunction(fn: string, body: Record<string, unknown>) {
    const auth = await getAuthHeader()
    if (!auth) throw new Error('Not authenticated')
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify(body),
      }
    )
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || res.statusText)
    return json
  }

  async function handleRegister() {
    if (!activeWallet?.id) return
    setActionLoading('registration')
    try {
      await callEdgeFunction('wallet-register', { wallet_id: activeWallet.id })
      toast.success('Registration request submitted. Pending compliance review.')
      await refetch()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleAcceptCredential() {
    if (!compliance?.credential_id) return
    setActionLoading('credential_accept')
    try {
      const result = await callEdgeFunction('credential-accept', {
        credential_id: compliance.credential_id,
      })
      if (result.ledger_status === 'accepted') {
        toast.success('Credential accepted. Your wallet is now trade-enabled.')
      } else if (result.qr_code) {
        // Mainnet: show QR (simplified — production would open a modal)
        toast.info('Scan the QR code in Xaman to accept your credential.', { duration: 10000 })
      }
      await refetch()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <CardTitle>Trading Compliance</CardTitle>
          {compliance?.is_trade_enabled && (
            <Badge variant="default" className="ml-auto bg-green-600 hover:bg-green-700">
              Trade-Enabled
            </Badge>
          )}
        </div>
        <CardDescription>
          Complete these steps to unlock permissioned trading on Accountabul.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!activeWallet && (
          <p className="text-sm text-muted-foreground mb-4">
            Connect a wallet to see your compliance status.
          </p>
        )}

        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <StepIcon status={step.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 ml-6">{step.description}</p>

                {step.id === 'kyc' && step.status === 'action' && (
                  <div className="ml-6 mt-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href="/kyc">Start identity verification</a>
                    </Button>
                  </div>
                )}

                {step.id === 'registration' && step.status === 'action' && (
                  <div className="ml-6 mt-2">
                    <Button
                      size="sm"
                      onClick={handleRegister}
                      disabled={actionLoading === 'registration'}
                    >
                      {actionLoading === 'registration' && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      Request trade registration
                    </Button>
                  </div>
                )}

                {step.id === 'registration' && step.status === 'error' && (
                  <div className="ml-6 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegister}
                      disabled={actionLoading === 'registration'}
                    >
                      Re-apply
                    </Button>
                  </div>
                )}

                {step.id === 'credential_accept' && step.status === 'action' && (
                  <div className="ml-6 mt-2">
                    <Button
                      size="sm"
                      onClick={handleAcceptCredential}
                      disabled={actionLoading === 'credential_accept'}
                    >
                      {actionLoading === 'credential_accept' && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      Accept credential
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        {compliance?.permission_profiles && compliance.permission_profiles.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-muted-foreground mb-2">Active permissions</p>
            <div className="flex flex-wrap gap-1.5">
              {compliance.permission_profiles.map(code => (
                <Badge key={code} variant="secondary" className="text-xs">{code}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
