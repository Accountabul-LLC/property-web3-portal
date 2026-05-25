import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Star, Zap } from 'lucide-react'
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
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1">
        {/* Hero */}
        <div className="text-center py-16 px-4">
          <Badge variant="secondary" className="mb-4">Membership Plans</Badge>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Protect and tokenize<br />your property
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Real estate on the blockchain. Deed fraud monitoring. Verified compliance. All in one platform.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-muted rounded-full px-4 py-2">
            <span className={cn('text-sm font-medium transition-colors', !annual ? 'text-foreground' : 'text-muted-foreground')}>
              Monthly
            </span>
            <button
              onClick={() => setAnnual(v => !v)}
              aria-label="Toggle annual billing"
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                annual ? 'bg-primary' : 'bg-muted-foreground/30'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                annual ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
            <span className={cn('text-sm font-medium transition-colors', annual ? 'text-foreground' : 'text-muted-foreground')}>
              Annual{' '}
              <span className="text-green-600 dark:text-green-400 font-semibold">Save 16%</span>
            </span>
          </div>
        </div>

        {/* Tier cards */}
        <div className="max-w-6xl mx-auto px-4 pb-24">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {tiers?.map((tier) => {
                const monthlyEquivalent = annual && tier.price_annual
                  ? tier.price_annual / 12
                  : tier.price_monthly
                const isCurrentTier = myTier?.id === tier.id

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

                    {/* Name + description */}
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-foreground mb-1">{tier.name}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{tier.description}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-bold text-foreground">
                          ${Math.round(monthlyEquivalent)}
                        </span>
                        <span className="text-muted-foreground mb-1.5 text-sm">/month</span>
                      </div>
                      {annual && tier.price_annual && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Billed ${tier.price_annual.toFixed(0)}/year
                        </p>
                      )}
                      {!annual && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Or ${tier.price_annual?.toFixed(0)}/year (save 16%)
                        </p>
                      )}
                      {tier.highlight_feature && (
                        <div className="flex items-center gap-1.5 mt-3 text-sm font-medium text-primary">
                          <Zap className="w-3.5 h-3.5" />
                          {tier.highlight_feature}
                        </div>
                      )}
                    </div>

                    {/* Features */}
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

                    {/* CTA */}
                    <Button
                      className="w-full"
                      variant={tier.is_popular ? 'default' : 'outline'}
                      size="lg"
                      disabled={isCurrentTier || selectMembership.isPending}
                      onClick={() => handleSelect(tier.id, tier.name)}
                    >
                      {isCurrentTier ? 'Current Plan' : tier.cta_label}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Trust line */}
          <p className="text-center text-sm text-muted-foreground mt-10">
            All plans include XRPL-backed security · Cancel anytime · Missouri deed monitoring powered by BatchData + Regrid
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
