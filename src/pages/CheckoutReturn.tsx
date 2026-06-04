import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { callEdgeFunction } from '@/lib/edgeFunction'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

type SessionInfo = {
  email: string | null
  subscriptionId: string | null
  customerId: string | null
  priceId: string | null
  status: string | null
}

export default function CheckoutReturn() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const sessionId = params.get('session_id')
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session_id')
      return
    }
    callEdgeFunction<SessionInfo>('stripe-get-checkout-session', { sessionId }, { requireAuth: false })
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : 'Lookup failed'))
  }, [sessionId])

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!info?.email) return
    setCreating(true)
    const { error } = await supabase.auth.signUp({
      email: info.email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    setCreating(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Check your email to confirm your account. Your membership will activate after sign-in.')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full">
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
            <h1 className="text-2xl font-bold">You're subscribed!</h1>
          </div>

          {error && <p className="text-sm text-destructive mb-4">{error}</p>}

          {info && (
            <>
              <p className="text-muted-foreground mb-6">
                Thanks for becoming a member{info.email ? `, ${info.email}` : ''}. Your subscription is{' '}
                <span className="font-medium text-foreground">{info.status ?? 'processing'}</span>.
              </p>

              {user ? (
                <Button onClick={() => navigate('/account/billing')}>Manage billing</Button>
              ) : info.email ? (
                <form onSubmit={createAccount} className="space-y-4 border-t border-border pt-6">
                  <h2 className="font-semibold">Finish creating your account</h2>
                  <p className="text-sm text-muted-foreground">
                    Set a password to access your member dashboard. Your subscription will attach automatically.
                  </p>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={info.email} disabled />
                  </div>
                  <div>
                    <Label className="text-xs">Password</Label>
                    <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={creating} className="w-full">
                    {creating ? 'Creating account…' : 'Create account'}
                  </Button>
                </form>
              ) : null}
            </>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  )
}
