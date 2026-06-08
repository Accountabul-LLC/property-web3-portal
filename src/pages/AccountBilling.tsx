import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { callEdgeFunction } from '@/lib/edgeFunction'
import { toast } from 'sonner'

type Sub = {
  status: string
  price_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
}

type CancelPreview = {
  originalAmountCents: number
  refundAmountCents: number
  currency: string
  daysUsed: number
  daysRemaining: number
}

function fmtMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

export default function AccountBilling() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [sub, setSub] = useState<Sub | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<CancelPreview | null>(null)
  const [showCancel, setShowCancel] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('subscriptions')
      .select('status, price_id, current_period_end, cancel_at_period_end, stripe_customer_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSub(data as Sub | null))
  }, [user])

  if (loading) return null
  if (!user) {
    navigate('/auth')
    return null
  }

  async function openPortal() {
    setBusy(true)
    try {
      const res = await callEdgeFunction<{ url: string }>('stripe-create-portal', {
        returnUrl: `${window.location.origin}/account/billing`,
      })
      window.location.href = res.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Portal failed')
    } finally {
      setBusy(false)
    }
  }

  async function previewCancel() {
    setBusy(true)
    try {
      const res = await callEdgeFunction<CancelPreview>('stripe-cancel-membership', { mode: 'preview' })
      setPreview(res)
      setShowCancel(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  async function confirmCancel() {
    setBusy(true)
    try {
      await callEdgeFunction<{ ok: true }>('stripe-cancel-membership', { mode: 'confirm' })
      toast.success('Membership canceled and refund issued.')
      setShowCancel(false)
      setSub((s) => (s ? { ...s, status: 'canceled' } : s))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  const isActive = sub && ['active', 'trialing', 'past_due'].includes(sub.status)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 w-full">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold mb-6">Billing</h1>

        <Card className="p-6">
          {!sub ? (
            <>
              <p className="text-muted-foreground mb-4">You don't have an active membership.</p>
              <Button onClick={() => navigate('/pricing')}>View plans</Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">{sub.status}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Renews</div>
                  <div className="font-medium">
                    {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '-'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Plan</div>
                  <div className="font-medium">{sub.price_id ?? '-'}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={openPortal} disabled={busy} variant="outline">
                  <ExternalLink className="w-4 h-4 mr-1.5" /> Manage in Stripe
                </Button>
                {isActive && (
                  <Button onClick={previewCancel} disabled={busy} variant="destructive">
                    Cancel membership
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      </main>
      <Footer />

      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel membership</DialogTitle>
            <DialogDescription>
              You'll lose access immediately. We'll issue a prorated refund based on unused days in your current cycle.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Original charge</span><span>{fmtMoney(preview.originalAmountCents, preview.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Days used / remaining</span><span>{preview.daysUsed} / {preview.daysRemaining}</span></div>
              <div className="flex justify-between font-medium pt-2 border-t border-border"><span>Refund amount</span><span>{fmtMoney(preview.refundAmountCents, preview.currency)}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancel(false)} disabled={busy}>Keep membership</Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={busy}>
              {busy ? 'Canceling…' : 'Confirm cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
