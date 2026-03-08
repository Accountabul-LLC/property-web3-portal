/**
 * CredentialLedgerPanel
 *
 * Shows all wallet_credentials rows with lifecycle state + analytics summary.
 * Admin can:
 *   • Issue a pending credential (issue-testnet-credential)
 *   • Revoke an issued or accepted credential (revoke-credential)
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
import { Loader2, Send, Trash2, RefreshCw, FileKey, BarChart3, ShieldCheck, Clock, AlertTriangle } from 'lucide-react'

interface CredentialRow {
  id: string
  ledger_status: string
  credential_type: string
  issuer_address: string
  tx_hash: string | null
  issued_at: string | null
  accepted_at: string | null
  created_at: string
  revoked_at: string | null
  user_wallets: {
    wallet_address: string
    user_id: string
    network: string
    label: string | null
  } | null
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending_issuance: 'secondary',
  issued: 'default',
  accepted: 'outline',
  failed: 'destructive',
  expired: 'destructive',
  deleted: 'destructive',
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

export function CredentialLedgerPanel() {
  const qc = useQueryClient()
  const [actioning, setActioning] = useState<string | null>(null)

  const { data: credentials = [], isLoading, refetch } = useQuery<CredentialRow[]>({
    queryKey: ['admin-credential-ledger'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('wallet_credentials')
        .select(`
          id, ledger_status, credential_type, issuer_address,
          tx_hash, issued_at, accepted_at, created_at, revoked_at,
          user_wallets ( wallet_address, user_id, network, label )
        `)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data ?? []
    },
  })

  // Analytics summary
  const analytics = {
    total: credentials.length,
    pending: credentials.filter(c => c.ledger_status === 'pending_issuance').length,
    issued: credentials.filter(c => c.ledger_status === 'issued').length,
    accepted: credentials.filter(c => c.ledger_status === 'accepted').length,
    revoked: credentials.filter(c => ['deleted', 'expired'].includes(c.ledger_status) || c.revoked_at).length,
  }

  async function handleIssue(cred: CredentialRow) {
    setActioning(cred.id)
    try {
      await callEdgeFn('issue-testnet-credential', { credential_id: cred.id })
      toast.success('Credential issued on XRPL. User can now accept it.')
      qc.invalidateQueries({ queryKey: ['admin-credential-ledger'] })
      qc.invalidateQueries({ queryKey: ['admin-issuer-status'] })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActioning(null)
    }
  }

  async function handleRevoke(cred: CredentialRow) {
    if (!confirm(`Revoke credential for ${cred.user_wallets?.wallet_address}? This will remove their trading access.`)) return
    setActioning(cred.id)
    try {
      await callEdgeFn('revoke-credential', { credential_id: cred.id, reason: 'Admin revocation' })
      toast.success('Credential revoked on XRPL.')
      qc.invalidateQueries({ queryKey: ['admin-credential-ledger'] })
      qc.invalidateQueries({ queryKey: ['admin-wallet-registrations'] })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActioning(null)
    }
  }

  const truncate = (s: string | null | undefined, n = 12) =>
    s ? `${s.slice(0, n)}…${s.slice(-6)}` : '—'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileKey className="h-5 w-5" />
            <CardTitle>Credential Ledger</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          All XRPL credential records — issuance state, on-chain hashes, and admin actions.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Analytics Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{analytics.total}</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{analytics.pending}</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{analytics.issued + analytics.accepted}</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Revoked</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{analytics.revoked}</p>
          </div>
        </div>

        {/* Credential List */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {!isLoading && credentials.length === 0 && (
          <p className="text-sm text-muted-foreground">No credentials yet.</p>
        )}

        {!isLoading && credentials.length > 0 && (
          <div className="space-y-3">
            {credentials.map(cred => (
              <div key={cred.id} className="border rounded-md p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs break-all">
                      {cred.user_wallets?.wallet_address ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cred.user_wallets?.network} · {cred.credential_type}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[cred.ledger_status] ?? 'secondary'}>
                    {cred.ledger_status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Issuer</span>
                  <span className="font-mono">{truncate(cred.issuer_address, 14)}</span>

                  {cred.tx_hash && (
                    <>
                      <span className="text-muted-foreground">Tx hash</span>
                      <span className="font-mono">{truncate(cred.tx_hash, 14)}</span>
                    </>
                  )}
                  {cred.issued_at && (
                    <>
                      <span className="text-muted-foreground">Issued</span>
                      <span>{new Date(cred.issued_at).toLocaleString()}</span>
                    </>
                  )}
                  {cred.accepted_at && (
                    <>
                      <span className="text-muted-foreground">Accepted</span>
                      <span>{new Date(cred.accepted_at).toLocaleString()}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(cred.created_at).toLocaleString()}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  {cred.ledger_status === 'pending_issuance' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleIssue(cred)}
                      disabled={actioning === cred.id}
                    >
                      {actioning === cred.id
                        ? <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        : <Send className="mr-2 h-3 w-3" />
                      }
                      Issue credential
                    </Button>
                  )}
                  {['issued', 'accepted'].includes(cred.ledger_status) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRevoke(cred)}
                      disabled={actioning === cred.id}
                    >
                      {actioning === cred.id
                        ? <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        : <Trash2 className="mr-2 h-3 w-3" />
                      }
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
