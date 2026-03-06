import React from 'react'
import { Navigate } from 'react-router-dom'
import { useKycStatus } from '@/hooks/useKycStatus'
import { Loader2 } from 'lucide-react'

interface KycGateProps {
  children: React.ReactNode
}

const KycGate = ({ children }: KycGateProps) => {
  const { status, isLoading } = useKycStatus()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'approved') {
    return <>{children}</>
  }

  if (status === 'not_started' || status === 'in_progress' || status === 'rejected' || status === 'expired') {
    return <Navigate to="/kyc" replace />
  }

  // submitted | under_review
  return <Navigate to="/kyc/status" replace />
}

export default KycGate
