import { useMemo } from 'react'
import { Wallet, AlertCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useActiveWallet, type XRPLNetwork } from '@/contexts/ActiveWalletContext'
import { useXRPLPortfolio } from '@/hooks/useXRPLPortfolio'

const RLUSD_CURRENCY_HEX = '524C555344000000000000000000000000000000'
const RLUSD_ISSUERS: Record<XRPLNetwork, string | null> = {
  mainnet: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
  testnet: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV',
}

export type SupportedAsset = 'XRP' | 'RLUSD'

interface Props {
  value: SupportedAsset[]
  onChange: (next: SupportedAsset[]) => void
}

export function AcceptedAssetsPicker({ value, onChange }: Props) {
  const { activeAddress, activeNetwork, openConnectModal } = useActiveWallet()
  const { data: portfolio, isLoading } = useXRPLPortfolio(activeAddress, activeNetwork)

  const hasRLUSDTrustline = useMemo(() => {
    if (!portfolio?.token_holdings) return false
    const issuer = RLUSD_ISSUERS[activeNetwork]
    return portfolio.token_holdings.some(
      (h) =>
        (h.currency === RLUSD_CURRENCY_HEX || h.currency === 'RLUSD') &&
        (!issuer || h.issuer === issuer)
    )
  }, [portfolio, activeNetwork])

  const otherHoldings = useMemo(() => {
    if (!portfolio) return [] as Array<{ label: string; sub: string }>
    const tokens = (portfolio.token_holdings ?? [])
      .filter(
        (h) => !(h.currency === RLUSD_CURRENCY_HEX || h.currency === 'RLUSD')
      )
      .map((h) => ({
        label: h.currency.length === 40 ? `Token (${h.currency.slice(0, 6)}…)` : h.currency,
        sub: `Trustline · ${h.issuer.slice(0, 8)}…`,
      }))
    const mpts = (portfolio.mpt_holdings ?? []).map((m) => ({
      label: 'MPT',
      sub: `${(m.mpt_issuance_id ?? '').slice(0, 12)}…`,
    }))
    return [...tokens, ...mpts]
  }, [portfolio])

  const toggle = (asset: SupportedAsset) => {
    if (asset === 'XRP') return // always required
    const has = value.includes(asset)
    onChange(has ? value.filter((a) => a !== asset) : [...value, asset])
  }

  // Not connected → connect prompt
  if (!activeAddress) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Wallet className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Connect your wallet to choose accepted assets
            </p>
            <p className="text-xs text-muted-foreground">
              We use your wallet's trustlines to show which assets you can receive.
              Until you connect, only XRP is accepted.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={openConnectModal}>
          Connect wallet
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Accepted assets</p>
        <p className="text-xs text-muted-foreground">
          Based on your connected wallet's holdings on {activeNetwork}. Donors will only
          be able to send the assets you select here.
        </p>
      </div>

      {/* XRP — locked on */}
      <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 cursor-default">
        <input
          type="checkbox"
          checked
          disabled
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">XRP</span>
            <Lock className="w-3 h-3 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Always accepted · Balance{' '}
            {isLoading
              ? '…'
              : (portfolio?.xrp_balance ?? 0).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
            XRP
          </p>
        </div>
      </label>

      {/* RLUSD — only if trustline */}
      {hasRLUSDTrustline ? (
        <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 cursor-pointer hover:border-primary/40 transition-colors">
          <input
            type="checkbox"
            checked={value.includes('RLUSD')}
            onChange={() => toggle('RLUSD')}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">RLUSD</span>
            <p className="text-xs text-muted-foreground">
              Ripple USD stablecoin · Trustline detected. Selecting this switches the
              campaign to direct mode (no escrow — funds forward immediately).
            </p>
          </div>
        </label>
      ) : (
        <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-background/50 p-3 opacity-70">
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-muted-foreground">RLUSD</span>
            <p className="text-xs text-muted-foreground">
              No RLUSD trustline on your connected wallet. Add one in Xaman to accept
              RLUSD donations.
            </p>
          </div>
        </div>
      )}

      {/* Other holdings — informational only */}
      {otherHoldings.length > 0 && (
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
            Other assets in your wallet ({otherHoldings.length}) — not supported yet
          </summary>
          <ul className="mt-2 space-y-1 pl-3">
            {otherHoldings.slice(0, 8).map((h, i) => (
              <li key={i} className="text-muted-foreground">
                <span className="font-medium text-foreground/70">{h.label}</span> · {h.sub}
              </li>
            ))}
            {otherHoldings.length > 8 && (
              <li className="text-muted-foreground">+ {otherHoldings.length - 8} more</li>
            )}
          </ul>
          <p className="mt-2 text-muted-foreground">
            The donation flow currently only supports XRP and RLUSD. Other tokens and MPTs
            can't be accepted through campaigns yet.
          </p>
        </details>
      )}
    </div>
  )
}
