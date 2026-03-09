import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useKycStatus } from '@/hooks/useKycStatus'
import { useWalletRegistration } from '@/hooks/useWalletRegistration'

interface Props {
  walletAddress: string
}

export function RegisterWalletButton({ walletAddress }: Props) {
  const { isApproved: kycApproved } = useKycStatus()
  const { isRegistered, isPending, isRevoked, isLoading, registerWallet } = useWalletRegistration(walletAddress)
  const [submitting, setSubmitting] = useState(false)

  async function handleRegister() {
    setSubmitting(true)
    try {
      await registerWallet()
      toast.success('Registration submitted. Pending review.')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return null

  if (isRegistered) {
    return (
      <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
        <ShieldCheck className="h-3 w-3" /> Registered
      </Badge>
    )
  }

  if (isPending) {
    return <Badge variant="secondary">Pending Review</Badge>
  }

  if (isRevoked) {
    return <Badge variant="destructive">Registration Suspended</Badge>
  }

  if (!kycApproved) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" variant="outline" disabled>
                Register for Trading
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Complete KYC verification to register wallet for trading</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Button size="sm" variant="outline" onClick={handleRegister} disabled={submitting}>
      {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
      Register for Trading
    </Button>
  )
}
