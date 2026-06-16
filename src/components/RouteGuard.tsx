import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { useFeatureGate } from '@/hooks/useFeatureGate'
import { useTeamAccess } from '@/hooks/useTeamAccess'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ShieldAlert, Lock } from 'lucide-react'

interface RouteGuardProps {
  children: React.ReactNode
  requiresLogin?: boolean
  requiresWallet?: boolean
  credentialKey?: string
  allowedAccountTypes?: string[]
  adminOnly?: boolean
}

export function RouteGuard({
  children,
  requiresLogin = true,
  requiresWallet = false,
  credentialKey,
  allowedAccountTypes,
  adminOnly = false,
}: RouteGuardProps) {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { activeAddress, walletsLoading } = useActiveWallet()
  const { hasAccess: isAdmin, loading: adminLoading } = useTeamAccess()
  const { data: gate, isLoading: gateLoading } = useFeatureGate(
    credentialKey ? activeAddress : null,
    credentialKey ?? null
  )

  // Only block on wallet loading when the route actually needs a wallet.
  const waitingForWallets = requiresWallet && walletsLoading
  if (authLoading || waitingForWallets || (credentialKey && gateLoading) || (adminOnly && adminLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (requiresLogin && !user) {
    return <Navigate to="/auth" replace />
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Coming Soon</p>
            <p className="text-sm text-muted-foreground">
              This feature isn't available yet. Check back soon.
            </p>
            <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }


  if (requiresWallet && !activeAddress) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="font-medium">Wallet Required</p>
            <p className="text-sm text-muted-foreground">Connect your wallet to access this page.</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (credentialKey && gate && !gate.is_eligible) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="font-medium">{gate.credential_name ?? 'Credential Required'}</p>
            <p className="text-sm text-muted-foreground">
              {gate.next_action ?? 'You need additional credentials to access this page.'}
            </p>
            <Button onClick={() => navigate('/credentials')}>View Credentials</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
