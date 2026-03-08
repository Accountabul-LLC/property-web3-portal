/**
 * PendingRegistrationsPanel
 *
 * Lists wallet_registrations in status pending or under_review.
 * Admin clicks "Approve & Issue" → gets Xaman QR to sign CredentialCreate.
 * Polls for signature → commits everything on success.
 */

import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, ShieldCheck, RefreshCw, User, X } from 'lucide-react'

interface WalletReg {
  id: string
  registration_status: string
  created_at: string
  notes: string | null
  user_id: string
  user_wallets: {
    id: string
    wallet_address: string
    network: string
    label: string | null
  } | null
  kyc_cases: {
    status: string
  } | null
}

async function callEdgeFn(fn: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || res.statusText)
  return json
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'default',
  under_review: 'secondary',
  approved: 'outline',
  rejected: 'destructive',
  revoked: 'destructive',
}

export function PendingRegistrationsPanel() {
  const qc = useQueryClient()
  const [actioning, setActioning] = useState<string | null>(null)

  // Xaman signing modal state
  const [signingModal, setSigningModal] = useState<{
    open: boolean
    qrCode: string | null
    deepLink: string | null
    uuid: string | null
    registrationId: string | null
  }>({ open: false, qrCode: null, deepLink: null, uuid: null, registrationId: null })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: registrations = [], isLoading, refetch } = useQuery<WalletReg[]>({
    queryKey: ['admin-wallet-registrations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('wallet_registrations')
        .select(`
          id, registration_status, created_at, notes, user_id,
          user_wallets ( id, wallet_address, network, label ),
          kyc_cases ( status )
        `)
        .in('registration_status', ['pending', 'under_review'])
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function handleApprove(reg: WalletReg) {
    setActioning(reg.id)
    try {
      const result = await callEdgeFn('wallet-approve', { registration_id: reg.id })

      if (result.xaman_uuid && result.qr_code) {
        // Open signing modal
        setSigningModal({
          open: true,
          qrCode: result.qr_code,
          deepLink: result.deep_link || null,
          uuid: result.xaman_uuid,
          registrationId: reg.id,
        })
        startPolling(result.xaman_uuid, reg.id)
      } else {
        toast.error('Unexpected response from approval flow')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActioning(null)
    }
  }

  function startPolling(uuid: string, registrationId: string) {
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      try {
        const result = await callEdgeFn('check-credential-payload', { uuid, registration_id: registrationId })

        if (result.signed) {
          stopPolling()
          setSigningModal(prev => ({ ...prev, open: false }))
          toast.success(`Wallet approved & credential issued! (tx: ${result.tx_hash?.slice(0, 12)}…)`)
          qc.invalidateQueries({ queryKey: ['admin-wallet-registrations'] })
          qc.invalidateQueries({ queryKey: ['admin-credential-ledger'] })
        } else if (result.cancelled) {
          stopPolling()
          setSigningModal(prev => ({ ...prev, open: false }))
          toast.warning('Signing cancelled. Registration reverted to pending.')
          refetch()
        } else if (result.expired) {
          stopPolling()
          setSigningModal(prev => ({ ...prev, open: false }))
          toast.warning('Signing expired. Registration reverted to pending.')
          refetch()
        }
      } catch (err: any) {
        console.error('Polling error:', err)
      }
    }, 2000)
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function handleCancelSigning() {
    stopPolling()
    setSigningModal({ open: false, qrCode: null, deepLink: null, uuid: null, registrationId: null })
    refetch()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Pending Wallet Approvals</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Wallet registrations awaiting compliance review.
            Approving will prompt you to sign a CredentialCreate transaction on XRPL via Xaman.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {!isLoading && registrations.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending registrations.</p>
          )}

          {!isLoading && registrations.length > 0 && (
            <div className="space-y-3">
              {registrations.map(reg => (
                <div key={reg.id} className="border rounded-md p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs text-muted-foreground">User ID</p>
                      <p className="font-mono text-xs break-all">{reg.user_id}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[reg.registration_status] ?? 'secondary'}>
                      {reg.registration_status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Wallet</span>
                    <span className="font-mono break-all">
                      {reg.user_wallets?.wallet_address ?? '—'}
                    </span>

                    <span className="text-muted-foreground">Network</span>
                    <span>{reg.user_wallets?.network ?? '—'}</span>

                    <span className="text-muted-foreground">KYC status</span>
                    <span>{reg.kyc_cases?.status ?? '—'}</span>

                    <span className="text-muted-foreground">Requested</span>
                    <span>{new Date(reg.created_at).toLocaleString()}</span>
                  </div>

                  <div className="pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(reg)}
                      disabled={actioning === reg.id || reg.registration_status === 'under_review'}
                    >
                      {actioning === reg.id
                        ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Preparing…</>
                        : reg.registration_status === 'under_review'
                          ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Awaiting signature…</>
                          : <><ShieldCheck className="mr-2 h-3 w-3" /> Approve &amp; Issue Credential</>
                      }
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Xaman Signing Modal */}
      <Dialog open={signingModal.open} onOpenChange={(open) => { if (!open) handleCancelSigning() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign Credential Transaction</DialogTitle>
            <DialogDescription>
              Scan this QR code with Xaman to sign the CredentialCreate transaction.
              The wallet will be approved only after you sign.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {signingModal.qrCode && (
              <img
                src={signingModal.qrCode}
                alt="Xaman QR Code"
                className="w-64 h-64 rounded-lg border"
              />
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for signature…
            </div>

            {signingModal.deepLink && (
              <a
                href={signingModal.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline"
              >
                Open in Xaman app
              </a>
            )}

            <Button variant="ghost" size="sm" onClick={handleCancelSigning}>
              <X className="mr-2 h-3 w-3" /> Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
