/**
 * PendingRegistrationsPanel
 *
 * Lists wallet_registrations in status pending or under_review.
 * Admin can approve (triggers wallet-approve) then issue credential
 * (triggers issue-testnet-credential) in one flow.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, ShieldCheck, RefreshCw, User } from 'lucide-react'

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

  const { data: registrations = [], isLoading, refetch } = useQuery<WalletReg[]>({
    queryKey: ['admin-wallet-registrations'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('wallet_registrations') as any)
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

  async function handleApprove(reg: WalletReg) {
    setActioning(reg.id)
    try {
      const approveResult = await callEdgeFn('wallet-approve', { registration_id: reg.id })
      toast.success('Registration approved.')

      // If issuer is configured, immediately issue the credential
      if (approveResult.issuer_configured && approveResult.credential_id) {
        try {
          await callEdgeFn('issue-testnet-credential', { credential_id: approveResult.credential_id })
          toast.success('XRPL credential issued. User can now accept it.')
        } catch (issueErr: any) {
          toast.warning(`Approved but credential issuance failed: ${issueErr.message}`)
        }
      } else if (!approveResult.issuer_configured) {
        toast.warning('Approved but no issuer wallet configured — issue credential manually once issuer is set up.')
      }

      qc.invalidateQueries({ queryKey: ['admin-wallet-registrations'] })
      qc.invalidateQueries({ queryKey: ['admin-credential-ledger'] })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActioning(null)
    }
  }

  return (
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
          Approving a wallet also issues the XRPL credential if an issuer is configured.
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
                    disabled={actioning === reg.id}
                  >
                    {actioning === reg.id
                      ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Processing…</>
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
  )
}
