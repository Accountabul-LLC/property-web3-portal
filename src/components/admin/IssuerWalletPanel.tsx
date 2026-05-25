/**
 * IssuerWalletPanel
 *
 * Shows the active testnet issuer wallet: address, XRP balance, seed status,
 * and lets an admin register a new issuer wallet in the DB.
 *
 * The seed itself is NEVER shown or stored here.
 * This panel only manages the DB record (address + secret_env_key pointer).
 *
 * To set up a testnet issuer:
 *   1. Generate a testnet wallet off-platform (e.g. xrpl.org/faucet)
 *   2. Set XRPL_TESTNET_ISSUER_SEED in Supabase Dashboard → Secrets
 *   3. Click "Register Issuer Wallet" and enter the r-address
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { callAdminEdgeFunction } from '@/lib/adminEdge'
import { callEdgeFunction } from '@/lib/edgeFunction'
import { toast } from 'sonner'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2, Wallet, RefreshCw } from 'lucide-react'

interface IssuerStatus {
  found: boolean
  issuer_id?: string
  issuer_name?: string
  issuer_address?: string
  environment?: string
  network?: string
  status?: string
  secret_env_key?: string
  seed_configured?: boolean
  last_used_at?: string
  created_at?: string
  xrpl?: {
    found: boolean
    balance_xrp?: string
    sequence?: number
    error?: string
  }
}

export function IssuerWalletPanel() {
  const qc = useQueryClient()
  const [showRegister, setShowRegister] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [newName, setNewName] = useState('accountabul_test_issuer')
  const [newEnvKey, setNewEnvKey] = useState('XRPL_TESTNET_ISSUER_SEED')
  const [registering, setRegistering] = useState(false)

  const { data, isLoading, refetch } = useQuery<IssuerStatus>({
    queryKey: ['admin-issuer-status'],
    queryFn: () => callEdgeFunction('get-issuer-status', { network: 'testnet' }),
    refetchInterval: 60_000,
  })

  async function handleRegister() {
    if (!newAddress.trim().match(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/)) {
      toast.error('Invalid XRPL address')
      return
    }
    setRegistering(true)
    try {
      await callAdminEdgeFunction('issuer-wallet-register', {
        issuer_name: newName.trim(),
        issuer_address: newAddress.trim(),
        environment: 'testnet',
        network: 'testnet',
        secret_env_key: newEnvKey.trim(),
      })
      toast.success('Issuer wallet registered.')
      setShowRegister(false)
      setNewAddress('')
      qc.invalidateQueries({ queryKey: ['admin-issuer-status'] })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRegistering(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Testnet Issuer Wallet</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Platform wallet that signs XRPL CredentialCreate transactions. The seed is stored
          only as a Supabase project secret — never in this database.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading issuer status…
          </div>
        )}

        {!isLoading && !data?.found && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              No active testnet issuer wallet registered.
            </p>
            <div className="rounded-md border p-4 text-sm space-y-1 text-muted-foreground">
              <p className="font-medium text-foreground">Setup steps:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Generate a testnet wallet at <code>xrpl.org/faucet</code> or via <code>xrpl-testnet-faucet</code></li>
                <li>Copy the seed and add it to Supabase Dashboard → Edge Functions → Secrets as <code>XRPL_TESTNET_ISSUER_SEED</code></li>
                <li>Register the r-address below</li>
              </ol>
            </div>
            <Button size="sm" onClick={() => setShowRegister(true)}>Register issuer wallet</Button>
          </div>
        )}

        {!isLoading && data?.found && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Name</span>
              <span className="font-mono">{data.issuer_name}</span>

              <span className="text-muted-foreground">Address</span>
              <span className="font-mono text-xs break-all">{data.issuer_address}</span>

              <span className="text-muted-foreground">Secret env key</span>
              <span className="font-mono text-xs">{data.secret_env_key}</span>

              <span className="text-muted-foreground">Seed configured</span>
              <span>
                {data.seed_configured
                  ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>
                  : <span className="flex items-center gap-1 text-red-600"><AlertCircle className="h-3.5 w-3.5" /> Not set — add to Supabase secrets</span>
                }
              </span>

              <span className="text-muted-foreground">DB status</span>
              <Badge variant={data.status === 'active' ? 'default' : 'secondary'} className="w-fit">
                {data.status}
              </Badge>

              {data.xrpl?.found && (
                <>
                  <span className="text-muted-foreground">XRP balance</span>
                  <span className="font-mono">{data.xrpl.balance_xrp} XRP</span>

                  <span className="text-muted-foreground">Ledger sequence</span>
                  <span className="font-mono">{data.xrpl.sequence}</span>
                </>
              )}

              {data.xrpl && !data.xrpl.found && (
                <>
                  <span className="text-muted-foreground">XRPL status</span>
                  <span className="text-yellow-600 text-xs">Account not found — fund it via testnet faucet</span>
                </>
              )}

              {data.last_used_at && (
                <>
                  <span className="text-muted-foreground">Last used</span>
                  <span className="text-xs">{new Date(data.last_used_at).toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        )}

        {showRegister && (
          <div className="border rounded-md p-4 space-y-3">
            <p className="text-sm font-medium">Register testnet issuer</p>
            <div className="space-y-2">
              <Label htmlFor="issuer-name">Issuer name</Label>
              <Input
                id="issuer-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="accountabul_test_issuer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issuer-address">XRPL r-address</Label>
              <Input
                id="issuer-address"
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="env-key">Supabase secret key name</Label>
              <Input
                id="env-key"
                value={newEnvKey}
                onChange={e => setNewEnvKey(e.target.value)}
                placeholder="XRPL_TESTNET_ISSUER_SEED"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                The Edge Function will load the seed via <code>Deno.env.get("{newEnvKey}")</code>.
                The actual seed is never stored in this form or in the database.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleRegister} disabled={registering}>
                {registering && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Register
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRegister(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
