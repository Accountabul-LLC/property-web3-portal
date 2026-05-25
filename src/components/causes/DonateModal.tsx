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
  // Balance is fetched on the user's selected network so they can verify funds before signing.
  const { data: portfolio, isLoading: balanceLoading } = useXRPLPortfolio(
    activeWallet?.address ?? null,
    activeNetwork
  )
  const networkMismatch = activeNetwork !== campaignNetwork
  const spendableXrp = portfolio?.spendable_xrp ?? 0
  // Reserve ~1 XRP headroom for the new escrow object reserve + fee
  const maxDonatable = useMemo(() => Math.max(0, Math.floor((spendableXrp - 1) * 1_000_000) / 1_000_000), [spendableXrp])

  const [step, setStep] = useState<Step>('form')
  const [asset, setAsset] = useState<'XRP' | 'RLUSD'>('XRP')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [deepLink, setDeepLink] = useState('')
  const [payloadUuid, setPayloadUuid] = useState('')
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null)

  const amt = parseFloat(amount)
  const insufficientFunds = asset === 'XRP' && !!amount && !Number.isNaN(amt) && amt > maxDonatable
  const balanceReady = !balanceLoading && !!activeWallet

  const releaseDate = new Date(campaign.release_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

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
    if (asset === 'RLUSD') {
      toast.info('RLUSD donations coming soon — switch to XRP to donate now.')
      return
    }
    if (!activeWallet) {
      toast.error('Connect a wallet to donate')
      return
    }
    if (!amt || amt < 1) {
      toast.error(`Minimum donation is 1 ${asset}`)
      return
    }
    if (asset === 'XRP' && amt > maxDonatable) {
      toast.error(`Not enough XRP in ${activeWallet.label}. Available to donate: ${maxDonatable} XRP.`)
      return
    }
    setLoading(true)
    try {
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

        if (json.status === 'escrowed') {
          clearInterval(interval)
          setStep('done')
          toast.success('Donation locked in escrow! Thank you.')
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
                Your donation is locked on the <strong>XRP Ledger</strong> until{' '}
                <strong>{releaseDate}</strong>, then sent directly to the recipient's wallet.
                You sign the transaction in your connected wallet — no platform holds your funds.
              </p>
            </div>

            {/* Asset toggle */}
            <div className="space-y-2">
              <Label>Asset</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['XRP', 'RLUSD'] as const).map((a) => (
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
              {asset === 'RLUSD' && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  RLUSD donations coming soon — switch to XRP to donate now.
                </p>
              )}
            </div>

            {/* Wallet picker */}
            {activeWallet && (
              <div className="space-y-2">
                <Label>Donate from</Label>
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
                    <><Loader2 className="w-3 h-3 animate-spin" /> Loading {campaignNetwork} balance…</>
                  ) : (
                    <>
                      <span className={campaignNetwork === 'mainnet' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                        {campaignNetwork === 'mainnet' ? '● Mainnet' : '● Testnet'}
                      </span>
                      balance: <strong className="text-foreground">{spendableXrp.toLocaleString(undefined, { maximumFractionDigits: 6 })} XRP</strong> · max donatable {maxDonatable.toLocaleString(undefined, { maximumFractionDigits: 6 })} XRP
                    </>
                  )}
                </p>

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
                type="number"
                min="1"
                step="0.1"
                placeholder="e.g. 100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {insufficientFunds ? (
                <p className="text-xs text-destructive">
                  Not enough XRP. Available to donate: {maxDonatable} XRP (≈1 XRP reserved on-ledger).
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
              <Button onClick={handleSubmit} disabled={loading || asset === 'RLUSD' || !activeWallet || (asset === 'XRP' && (!balanceReady || insufficientFunds))} className="w-full">
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
              Scan with your wallet app to sign the escrow transaction.
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
                Your donation is locked in escrow on the XRP Ledger. It will be released to the recipient on {releaseDate}.
              </p>
            </div>
            <Button onClick={resetAndClose} className="w-full">Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
