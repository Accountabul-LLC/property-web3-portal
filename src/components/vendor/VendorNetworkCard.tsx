import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CredentialEligibilityResult } from '@/hooks/useCredentialEligibility'
import {
  getVendorNetworkState,
  getVendorStatusConfig,
} from '@/lib/vendorNetwork'
import { BadgeCheck, Star, Wallet, FileText } from 'lucide-react'

interface VendorNetworkCardProps {
  accountType: string | undefined
  companyName: string | null | undefined
  isConnected: boolean
  kycApproved: boolean
  vendorCredential: CredentialEligibilityResult | null
  actionLoading: boolean
  onConnectWallet: () => void
  onStartKyc: () => void
  onEditProfile: () => void
  onRequestVerification: () => void
  onAcceptBadge: () => void
  onOpenCredentials: () => void
}

export function VendorNetworkCard({
  accountType,
  companyName,
  isConnected,
  kycApproved,
  vendorCredential,
  actionLoading,
  onConnectWallet,
  onStartKyc,
  onEditProfile,
  onRequestVerification,
  onAcceptBadge,
  onOpenCredentials,
}: VendorNetworkCardProps) {
  const vendorState = getVendorNetworkState(vendorCredential)
  const status = getVendorStatusConfig(vendorState)
  const requirements = vendorCredential?.requirements ?? []
  const walletCredentialId = vendorCredential?.existing_application?.wallet_credential_id ?? null
  const canAcceptBadge = vendorState === 'ready_to_accept' && Boolean(walletCredentialId)

  const primaryAction = (() => {
    if (accountType !== 'business') return onEditProfile
    if (!isConnected) return onConnectWallet
    if (!kycApproved) return onStartKyc
    if (vendorState === 'ready_to_accept') return canAcceptBadge ? onAcceptBadge : onOpenCredentials
    if (vendorState === 'needs_more_info') return onOpenCredentials
    if (vendorState === 'unavailable') return onEditProfile
    return onRequestVerification
  })()

  const primaryLabel = (() => {
    if (accountType !== 'business') return 'Switch to Business'
    if (!isConnected) return 'Connect Wallet'
    if (!kycApproved) return 'Start KYC'
    if (vendorState === 'ready_to_accept' && !canAcceptBadge) return 'Review Credentials'
    return status.ctaLabel
  })()

  const showRequirements = vendorState === 'needs_more_info' && requirements.length > 0

  return (
    <Card className="mb-8 border-amber-200/70 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/70 via-background to-background dark:from-amber-950/20 dark:via-background dark:to-background">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-xl">{status.title}</CardTitle>
              <CardDescription className="mt-1 max-w-2xl">{status.description}</CardDescription>
            </div>
          </div>
          <Badge variant={status.badgeVariant} className="whitespace-nowrap">
            <BadgeCheck className="w-3.5 h-3.5 mr-1" />
            {status.badgeLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
            <FileText className="w-3.5 h-3.5" />
            {accountType === 'business' ? 'Business profile' : 'Individual profile'}
          </span>
          {companyName && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
              {companyName}
            </span>
          )}
          {isConnected && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
              <Wallet className="w-3.5 h-3.5" />
              Wallet connected
            </span>
          )}
        </div>

        {showRequirements ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {requirements.map((req) => (
              <div key={req.requirement_key} className="rounded-lg border border-border/70 bg-background/80 p-3">
                <p className="text-sm font-medium">{req.display_label}</p>
                {req.display_hint && (
                  <p className="mt-1 text-xs text-muted-foreground">{req.display_hint}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Verified vendors get a visible star badge on their business profile and can be surfaced in marketplace and CRM-style vendor views.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {primaryLabel && primaryAction && (
            <Button
              onClick={primaryAction}
              disabled={actionLoading}
              className="gap-2"
            >
              <Star className="w-4 h-4" />
              {primaryLabel}
            </Button>
          )}
          {vendorState === 'active' ? (
            <Button variant="outline" onClick={onOpenCredentials}>
              Review Credential Details
            </Button>
          ) : vendorState === 'needs_more_info' ? (
            <Button variant="outline" onClick={onOpenCredentials}>
              Open Credential Checklist
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
