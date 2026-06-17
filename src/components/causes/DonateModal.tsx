import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Lock, ExternalLink, Loader2, CheckCircle2, Heart, Wallet as WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import type { Campaign } from '@/hooks/useCampaigns'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { useXRPLPortfolio } from '@/hooks/useXRPLPortfolio'
import NetworkToggle from '@/components/NetworkToggle'
import { useKycGate } from '@/hooks/useKycGate'

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''
}

type Step = 'form' | 'qr' | 'confirming' | 'done'

type Props = {
  campaign: Campaign
  open: boolean
  onClose: () => void
}

export default function DonateModal({ campaign, open, onClose }: Props) {
  const { wallets, activeWallet, setActiveWallet, activeNetwork } = useActiveWallet()
  const campaignNetwork = (campaign.network === 'testnet' ? 'testnet' : 'mainnet') as 'mainnet' | 'testnet'
  const isDirectCampaign = campaign.campaign_mode === 'evergreen'
  // Balance is fetched on the user's selected network so they can verify funds before signing.
  const { data: portfolio, isLoading: balanceLoading } = useXRPLPortfolio(
    activeWallet?.address ?? null,
    activeNetwork
  )
  const networkMismatch = activeNetwork !== campaignNetwork
  const spendableXrp = portfolio?.spendable_xrp ?? 0
  const reserveXrp = isDirectCampaign ? 0 : 1
  // Escrow campaigns need extra reserve for the escrow object; direct payments do not.
  const maxDonatable = useMemo(() => Math.max(0, Math.floor((spendableXrp - reserveXrp) * 1_000_000) / 1_000_000), [spendableXrp, reserveXrp])

  const allowedAssets = (Array.isArray(campaign.accepted_assets) && campaign.accepted_assets.length > 0
    ? campaign.accepted_assets
    : ['XRP']) as Array<'XRP' | 'RLUSD'>
  const rlusdAllowedForCampaign = allowedAssets.includes('RLUSD') && isDirectCampaign

  const [step, setStep] = useState<Step>('form')
  const [asset, setAsset] = useState<'XRP' | 'RLUSD'>(allowedAssets[0] ?? 'XRP')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [deepLink, setDeepLink] = useState('')
  const [payloadUuid, setPayloadUuid] = useState('')
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null)
  const kycGate = useKycGate()

  const isPartialDecimal = (value: string) => /^\d*\.?\d*$/.test(value)
  const isPlainDecimal = (value: string) => /^\d+(\.\d+)?$/.test(value)

  const amt = parseFloat(amount)
  const insufficientFunds = asset === 'XRP' && !!amount && isPlainDecimal(amount) && !Number.isNaN(amt) && amt > maxDonatable
  const balanceReady = !balanceLoading && !!activeWallet

  const releaseDate = campaign.release_date
    ? new Date(campaign.release_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  function resetAndClose() {
    if (pollInterval) clearInterval(pollInterval)
    setStep('form')
    setAmount('')
    setAsset('XRP')
    setMessage('')
    setIsAnonymous(false)
    setQrUrl('')
    setDeepLink('')
    setPayloadUuid('')
    onClose()
  }

  async function handleSubmit() {
    if (asset === 'RLUSD' && !rlusdAllowedForCampaign) {
      toast.info(allowedAssets.includes('RLUSD')
        ? 'RLUSD is only supported on direct (evergreen) causes. This cause uses time-locked escrow - switch to XRP.'
        : 'This cause does not accept RLUSD. Switch to XRP to donate now.')
      return
    }
    if (!activeWallet) {
      toast.error('Connect a wallet to donate')
      return
    }
    if (!isPlainDecimal(amount) || !amt || amt < 1) {
      toast.error(`Minimum donation is 1 ${asset}`)
      return
    }
    if (asset === 'XRP' && amt > maxDonatable) {
      toast.error(`Not enough XRP in ${activeWallet.label}. Available to donate: ${maxDonatable} XRP.`)
      return
    }
    setLoading(true)
    try {
      // Hard KYC gate before opening Xaman.
      try {
        await kycGate.guard()
      } catch (gErr) {
        if (kycGate.handleThrown(gErr)) return
        throw gErr
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Please sign in to donate')
        return
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-donate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          campaign_id: campaign.id,
          amount: amt,
          currency: asset,
          donor_message: message || null,
          is_anonymous: isAnonymous,
        }),
      })

      const json = await res.json()
      if (kycGate.handleEdgeResponse(json, null)) return
      if (!res.ok) throw new Error(json.error || 'Failed to create donation')

      setQrUrl(json.qr_code)
      setDeepLink(json.deep_link)
      setPayloadUuid(json.xaman_uuid)
      setStep('qr')
      startPolling(json.xaman_uuid, session.access_token)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  function startPolling(uuid: string, token: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-check-donation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ xaman_uuid: uuid }),
        })
        const json = await res.json()

        if (json.status === 'escrowed' || json.status === 'released') {
          clearInterval(interval)
          setStep('done')
          toast.success(json.status === 'released' ? 'Donation sent! Thank you.' : 'Donation locked in escrow! Thank you.')
        } else if (json.status === 'failed') {
          clearInterval(interval)
          setStep('form')
          toast.error(
            json.message ?? `Transaction rejected by the XRP Ledger (${json.engine_result ?? 'unknown'}).`,
            { duration: 10000 }
          )
        } else if (json.status === 'cancelled' || json.status === 'expired') {
          clearInterval(interval)
          setStep('form')
          toast.info('Signing cancelled. You can try again.')
        }
      } catch {
        // keep polling
      }
    }, 3000)
    setPollInterval(interval)
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Heart className="w-5 h-5 text-primary" />
            <span>Donate to {campaign.title}</span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                campaignNetwork === 'mainnet'
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
              }`}
            >
              {campaignNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </span>
          </DialogTitle>
        </DialogHeader>


        {step === 'form' && (
          <div className="space-y-4">
            {/* Escrow explainer */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-3">
              <Lock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isDirectCampaign ? (
                  <>
                    Your donation is sent directly to the recipient's wallet after you sign the
                    payment in Xaman. No platform wallet holds your funds.
                  </>
                ) : (
                  <>
                    Your donation is locked on the <strong>XRP Ledger</strong> until{' '}
                    <strong>{releaseDate}</strong>, then sent directly to the recipient's wallet.
                    You sign the transaction in your connected wallet - no platform holds your funds.
                  </>
                )}
              </p>
            </div>

            {/* Asset toggle - only assets whitelisted by the cause */}
            <div className="space-y-2">
              <Label>Asset</Label>
              <div className={`grid gap-2 ${allowedAssets.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {allowedAssets.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAsset(a)}
                    className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                      asset === a
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {asset === 'RLUSD' && !rlusdAllowedForCampaign && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  RLUSD is only available on direct (evergreen) causes - this one uses time-locked escrow. Switch to XRP.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                This cause only accepts {allowedAssets.join(' or ')} through the platform.
              </p>
            </div>

            {/* Wallet picker */}
            {activeWallet && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Donate from</Label>
                  <NetworkToggle />
                </div>
                {wallets.length > 1 ? (
                  <Select value={activeWallet.address} onValueChange={(v) => setActiveWallet(v)}>
                    <SelectTrigger className="h-auto py-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (
                        <SelectItem key={w.address} value={w.address}>
                          <div className="flex items-center gap-2">
                            <WalletIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium">{w.label}</span>
                            <span className="text-xs text-muted-foreground">{shortAddr(w.address)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    <WalletIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{activeWallet.label}</span>
                    <span className="text-xs text-muted-foreground">{shortAddr(activeWallet.address)}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                  {balanceLoading ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Loading {activeNetwork} balance…</>
                  ) : (
                    <>
                      <span className={activeNetwork === 'mainnet' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                        {activeNetwork === 'mainnet' ? '● Mainnet' : '● Testnet'}
                      </span>
                      balance: <strong className="text-foreground">{spendableXrp.toLocaleString(undefined, { maximumFractionDigits: 6 })} XRP</strong> · max donatable {maxDonatable.toLocaleString(undefined, { maximumFractionDigits: 6 })} XRP
                    </>
                  )}
                </p>
                {networkMismatch && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
                    This campaign signs on <strong>{campaignNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'}</strong>. Switch the toggle to match before donating.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount ({asset})</Label>
                {asset === 'XRP' && balanceReady && maxDonatable > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(maxDonatable))}
                    className="text-xs text-primary hover:underline"
                  >
                    Max
                  </button>
                )}
              </div>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                pattern="^\\d+(\\.\\d+)?$"
                placeholder="e.g. 100"
                value={amount}
                maxLength={20}
                onChange={(e) => {
                  const next = e.target.value.trim();
                  if (isPartialDecimal(next)) setAmount(next);
                }}
              />
              {insufficientFunds ? (
                <p className="text-xs text-destructive">
                  Not enough XRP. Available to donate: {maxDonatable} XRP{isDirectCampaign ? '' : ' (≈1 XRP reserved on-ledger)'}.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Minimum 1 {asset}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Leave a message of support..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={280}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="anon" className="cursor-pointer">Donate anonymously</Label>
              <Switch id="anon" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            </div>

            <div className="pt-2 space-y-2">
              <Button onClick={handleSubmit} disabled={loading || (asset === 'RLUSD' && !rlusdAllowedForCampaign) || !activeWallet || (asset === 'XRP' && (!balanceReady || insufficientFunds))} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Heart className="w-4 h-4 mr-2" />}
                {loading ? 'Preparing...' : 'Donate'}
              </Button>
              <Button variant="ghost" onClick={resetAndClose} className="w-full text-muted-foreground">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === 'qr' && (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan with your wallet app to sign the {isDirectCampaign ? 'payment' : 'escrow'} transaction.
            </p>
            {qrUrl ? (
              <img src={qrUrl} alt="Xaman QR Code" className="mx-auto w-52 h-52 rounded-lg" />
            ) : (
              <div className="mx-auto w-52 h-52 bg-muted rounded-lg flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Waiting for signature...
            </div>
            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open in Xaman app <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <Button variant="ghost" onClick={resetAndClose} className="w-full text-muted-foreground text-xs">
              Cancel
            </Button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-lg">Thank you!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isDirectCampaign
                  ? 'Your donation was sent directly to the recipient after signing.'
                  : `Your donation is locked in escrow on the XRP Ledger. It will be released to the recipient on ${releaseDate}.`}
              </p>
            </div>
            <Button onClick={resetAndClose} className="w-full">Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
