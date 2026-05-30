import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Star, Zap, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { useMembershipTiers, useMyMembership, useSelectMembership } from '@/hooks/useMembershipTiers'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function Pricing() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [annual, setAnnual] = useState(false)
  const { data: tiers, isLoading } = useMembershipTiers()
  const { data: myTier } = useMyMembership()
  const selectMembership = useSelectMembership()

  function getDisplayedPrice(tier: NonNullable<typeof tiers>[number]) {
    if (tier.price_label) return tier.price_label
    if (annual && tier.price_annual != null) {
      return `$${Math.round(Number(tier.price_annual) / 12)}`
    }
    if (tier.slug === 'starter') return '$16'
    return `$${Math.round(Number(tier.price_monthly))}`
  }

  function isSelectable(tier: NonNullable<typeof tiers>[number]) {
    return tier.slug === 'starter'
  }

  async function handleSelect(tierId: string, tierName: string) {
    if (!user) {
      navigate('/auth', { state: { next: '/pricing' }, replace: false })
      return
    }
    try {
      await selectMembership.mutateAsync(tierId)
      toast.success(`You're now on the ${tierName} plan!`)
    } catch {
      toast.error('Failed to update plan. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <Navigation />

      <main className="flex-1 w-full overflow-x-hidden">
        {user && (
          <div className="max-w-6xl mx-auto px-4 pt-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </div>
        )}
        <div className="text-center py-16 px-4">

          <Badge variant="secondary" className="mb-4">Membership Plans</Badge>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Membership that grows<br />with your property
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            NFT membership, rewards access, and future fractional real estate perks built into one platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {['Membership NFT', 'Rewards access', 'Fractional real estate'].map((item) => (
              <span
                key={item}
                className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>

          <div
            className="inline-flex items-center rounded-full bg-muted p-1"
            role="group"
            aria-label="Billing frequency"
          >
            <button
              type="button"
              onClick={() => setAnnual(false)}
              aria-pressed={!annual}
              className={cn(
                'h-9 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                !annual ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              aria-pressed={annual}
              className={cn(
                'h-9 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                annual ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Annual <span className="font-semibold">Save 16%</span>
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-24">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-2xl border border-border bg-card p-8 animate-pulse">
                  <div className="h-5 w-24 bg-muted rounded mb-3" />
                  <div className="h-3 w-full bg-muted rounded mb-6" />
                  <div className="h-10 w-32 bg-muted rounded mb-6" />
                  <div className="space-y-3 mb-8">
                    {[...Array(5)].map((_, j) => (
                      <div key={j} className="h-3 w-full bg-muted rounded" />
                    ))}
                  </div>
                  <div className="h-10 w-full bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {tiers?.map((tier) => {
                const isCurrentTier = myTier?.id === tier.id
                const displayPrice = getDisplayedPrice(tier)
                const lockedPlan = !isSelectable(tier) || tier.price_label === 'TBD'

                return (
                  <div
                    key={tier.id}
                    className={cn(
                      'relative rounded-2xl border p-8 flex flex-col',
                      tier.is_popular
                        ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10'
                        : 'border-border bg-card'
                    )}
                  >
                    {tier.is_popular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <Badge className="bg-primary text-primary-foreground px-4 py-1 flex items-center gap-1 shadow-sm">
                          <Star className="w-3 h-3 fill-current" /> Most Popular
                        </Badge>
                      </div>
                    )}

                    {isCurrentTier && (
                      <div className="absolute -top-3.5 right-4 whitespace-nowrap">
                        <Badge className="bg-green-600 text-white px-3 py-1 shadow-sm">
                          Current Plan
                        </Badge>
                      </div>
                    )}

                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-foreground mb-1">{tier.name}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{tier.description}</p>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-bold text-foreground">
                          {displayPrice}
                        </span>
                        {tier.price_label === 'TBD' ? (
                          <span className="text-muted-foreground mb-1.5 text-sm">pricing coming soon</span>
                        ) : (
                          <span className="text-muted-foreground mb-1.5 text-sm">/month</span>
                        )}
                      </div>
                      {tier.price_label !== 'TBD' && annual && tier.price_annual && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Billed ${tier.price_annual.toFixed(0)}/year
                        </p>
                      )}
                      {tier.price_label !== 'TBD' && !annual && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Or ${tier.price_annual?.toFixed(0)}/year (save 16%)
                        </p>
                      )}
                      {tier.price_label === 'TBD' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          This plan is being finalized. Join the waitlist for updates.
                        </p>
                      )}
                      {tier.highlight_feature && (
                        <div className="flex items-center gap-1.5 mt-3 text-sm font-medium text-primary">
                          <Zap className="w-3.5 h-3.5" />
                          {tier.highlight_feature}
                        </div>
                      )}
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {(tier.features as string[]).map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                          <Check className={cn(
                            'w-4 h-4 shrink-0 mt-0.5',
                            tier.is_popular ? 'text-primary' : 'text-muted-foreground'
                          )} />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={tier.is_popular ? 'default' : 'outline'}
                      size="lg"
                      disabled={isCurrentTier || selectMembership.isPending || lockedPlan}
                      onClick={() => handleSelect(tier.id, tier.name)}
                    >
                      {isCurrentTier ? 'Current Plan' : tier.cta_label}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-center text-xs sm:text-sm text-muted-foreground mt-10 px-4 break-words">
            All plans include XRPL-backed security · Cancel anytime · Membership rewards included · Missouri deed monitoring powered by BatchData + Regrid
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
