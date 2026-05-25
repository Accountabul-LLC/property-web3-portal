import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Lock, ExternalLink, Loader2, CheckCircle2, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import type { Campaign } from '@/hooks/useCampaigns'

type Step = 'form' | 'qr' | 'confirming' | 'done'

type Props = {
  campaign: Campaign
  open: boolean
  onClose: () => void
}

export default function DonateModal({ campaign, open, onClose }: Props) {
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

  const releaseDate = new Date(campaign.release_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  function resetAndClose() {
    if (pollInterval) clearInterval(pollInterval)
    setStep('form')
    setAmount('')
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
    const amt = parseFloat(amount)
    if (!amt || amt < 1) {
      toast.error(`Minimum donation is 1 ${asset}`)
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
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            Donate to {campaign.title}
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

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({asset})</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.1"
                placeholder="e.g. 100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Minimum 1 {asset}</p>
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
              <Button onClick={handleSubmit} disabled={loading || asset === 'RLUSD'} className="w-full">
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
