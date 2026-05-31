import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { ShieldCheck, Loader2, Camera, FileText, UserCheck, ArrowRight } from 'lucide-react'

const STRIPE_IDENTITY_SETUP_COPY =
  'Identity verification is not ready yet because Stripe Identity still needs to be enabled on the connected Stripe account. Please try again after setup is complete.'

const Kyc = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [starting, setStarting] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/auth')
      return
    }
    // If already submitted / approved / under_review, jump straight to status page
    ;(async () => {
      const { data } = await (supabase.from('kyc_cases') as any)
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.status && ['submitted', 'under_review', 'approved'].includes(data.status)) {
        navigate('/kyc/status')
        return
      }
      setCheckingStatus(false)
    })()
  }, [user, authLoading])

  const startVerification = async () => {
    setStarting(true)
    setSetupError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-identity-create-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        },
      )
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.setup_required) {
          setSetupError(STRIPE_IDENTITY_SETUP_COPY)
          throw new Error(STRIPE_IDENTITY_SETUP_COPY)
        }
        throw new Error(data.error || 'Failed to start verification')
      }
      if (!data.url) throw new Error('No verification URL returned')
      // Redirect to Stripe-hosted verification flow
      window.location.href = data.url
    } catch (err: any) {
      toast.error(err.message)
      setStarting(false)
    }
  }

  if (authLoading || checkingStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Verify your identity</h1>
          <p className="text-muted-foreground text-sm">
            Powered by Stripe Identity. Takes about 2 minutes.
          </p>
        </div>

        <Card className="p-6 space-y-5">
          <p className="text-sm text-muted-foreground">
            To unlock trading, minting, and tokenization, we need to verify who you are.
            You'll need a government-issued photo ID and your phone or webcam.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Photo of your ID</p>
                <p className="text-xs text-muted-foreground">Passport, driver's license, or national ID card.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Live selfie</p>
                <p className="text-xs text-muted-foreground">A quick live capture to match your face to the ID.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Compliance review</p>
                <p className="text-xs text-muted-foreground">Our team confirms the result — usually within minutes.</p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            Your ID and selfie are handled directly by Stripe under their security and privacy controls. We only receive the verification outcome.
          </div>

          {setupError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {setupError}
            </div>
          )}

          <Button className="w-full" size="lg" onClick={startVerification} disabled={starting}>
            {starting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Opening Stripe…
              </>
            ) : (
              <>
                Start verification <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

export default Kyc
