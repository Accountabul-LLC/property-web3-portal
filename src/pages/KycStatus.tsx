import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useKycStatus } from '@/hooks/useKycStatus'
import { Clock, CheckCircle2, XCircle, Loader2, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react'

const statusConfig = {
  not_started: {
    icon: Clock,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    label: 'Not Started',
    description: 'You have not started the KYC process yet.',
  },
  in_progress: {
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    label: 'In Progress',
    description: 'Your application is not yet submitted.',
  },
  submitted: {
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    label: 'Submitted',
    description: 'Your application has been submitted and is awaiting review. This typically takes 1-2 business days.',
  },
  under_review: {
    icon: RefreshCw,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    label: 'Under Review',
    description: 'A compliance officer is reviewing your application. You will be notified of the outcome.',
  },
  approved: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950/20',
    label: 'Approved',
    description: 'Your identity has been verified. You can now access all platform features.',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950/20',
    label: 'Rejected',
    description: 'Your application was not approved.',
  },
  expired: {
    icon: Clock,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    label: 'Expired',
    description: 'Your KYC verification has expired. Please reapply.',
  },
}

const KycStatus = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { status, rejectionReason, isLoading, isApproved } = useKycStatus()

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth')
  }, [user, authLoading])

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const config = statusConfig[status] ?? statusConfig.not_started
  const Icon = config.icon

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-lg mx-auto px-4 py-16">
        <Card className="p-8 text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${config.bg} mb-4`}>
            <Icon className={`w-8 h-8 ${config.color}`} />
          </div>

          <Badge variant="outline" className={`mb-3 ${config.color}`}>
            {config.label}
          </Badge>

          <h1 className="text-xl font-bold mb-2">Identity Verification</h1>
          <p className="text-muted-foreground text-sm mb-6">{config.description}</p>

          {status === 'rejected' && rejectionReason && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200 mb-6 text-left">
              <p className="font-medium mb-1">Rejection reason:</p>
              <p>{rejectionReason}</p>
            </div>
          )}

          {(status === 'submitted' || status === 'under_review') && (
            <p className="text-xs text-muted-foreground mb-6">
              This page refreshes automatically. You can safely close it and come back.
            </p>
          )}

          <div className="space-y-3">
            {isApproved && (
              <Button className="w-full" onClick={() => navigate('/dashboard')}>
                Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {(status === 'not_started' || status === 'in_progress') && (
              <Button className="w-full" onClick={() => navigate('/kyc')}>
                {status === 'in_progress' ? 'Resume Application' : 'Start Verification'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {(status === 'rejected' || status === 'expired') && (
              <Button className="w-full" onClick={() => navigate('/kyc')}>
                Reapply <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </Card>

        {(status === 'submitted' || status === 'under_review') && (
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3" />
            Auto-refreshing every 30 seconds
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default KycStatus
