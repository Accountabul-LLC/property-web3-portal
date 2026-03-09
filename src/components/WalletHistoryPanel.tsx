import { useWalletHistory } from '@/hooks/useWalletHistory'
import { RegisterWalletButton } from '@/components/RegisterWalletButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, RefreshCw, Copy } from 'lucide-react'
import { toast } from 'sonner'

function truncate(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

async function copyAddress(addr: string) {
  await navigator.clipboard.writeText(addr)
  toast.success('Address copied')
}

export function WalletHistoryPanel() {
  const { history, isLoading, refetch } = useWalletHistory()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <CardTitle>Wallet History</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {!isLoading && history.length === 0 && (
          <p className="text-sm text-muted-foreground">No wallet history yet.</p>
        )}

        {!isLoading && history.length > 0 && (
          <div className="space-y-3">
            {history.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border flex-wrap gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-xs">{truncate(w.wallet_address)}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground"
                      onClick={() => copyAddress(w.wallet_address)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Connected {new Date(w.created_at).toLocaleDateString()}
                    {w.label && ` · ${w.label}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={w.status === 'active' ? 'default' : 'secondary'}>
                    {w.status === 'active' ? 'Active' : 'Revoked'}
                  </Badge>
                  {w.status === 'active' && (
                    <RegisterWalletButton walletAddress={w.wallet_address} />
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
