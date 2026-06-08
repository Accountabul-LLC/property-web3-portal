/**
 * TradeGuard
 *
 * Wraps any trade-gated UI (buy buttons, order forms, offer creation).
 * Renders children only when the active wallet is trade-enabled.
 * Otherwise renders a contextual compliance prompt.
 *
 * Usage:
 *   <TradeGuard>
 *     <PlaceOrderButton />
 *   </TradeGuard>
 *
 * Props:
 *   children      - content shown when trade-enabled
 *   fallback      - optional custom fallback; defaults to a compliance prompt card
 *   compact       - renders a compact inline message instead of a full card
 */

import { ReactNode } from 'react'
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useWalletCompliance, complianceStepLabel } from '@/hooks/useWalletCompliance'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'

interface TradeGuardProps {
  children: ReactNode
  fallback?: ReactNode
  compact?: boolean
}

export function TradeGuard({ children, fallback, compact = false }: TradeGuardProps) {
  const { activeWallet } = useActiveWallet()
  const { data: compliance, isLoading } = useWalletCompliance(activeWallet?.address)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking trading status…
      </div>
    )
  }

  if (compliance?.is_trade_enabled) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  const nextStep = complianceStepLabel(compliance)

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldAlert className="h-4 w-4 text-yellow-500 shrink-0" />
        <span>
          Trading not enabled.{' '}
          <a href="/compliance" className="underline underline-offset-2 hover:text-foreground">
            {nextStep}
          </a>
        </span>
      </div>
    )
  }

  return (
    <Alert>
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Trading access required</AlertTitle>
      <AlertDescription className="mt-1 space-y-3">
        <p className="text-sm">
          Your wallet must complete the compliance process before placing orders or purchasing
          property tokens.
        </p>
        <p className="text-sm text-muted-foreground">Next step: <strong>{nextStep}</strong></p>
        <Button size="sm" asChild>
          <a href="/compliance">
            <ShieldCheck className="mr-2 h-3.5 w-3.5" />
            Go to compliance
          </a>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
