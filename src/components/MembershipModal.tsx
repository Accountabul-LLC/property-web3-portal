import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Star } from 'lucide-react';
import { useMembershipTiers } from '@/hooks/useMembershipTiers';
import { cn } from '@/lib/utils';

interface MembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: () => void;
}

const fallbackTiers = [
  {
    id: 'starter',
    name: 'Starter',
    price_monthly: 19,
    price_annual: 190,
    description: 'Essential deed protection and first property setup.',
    features: ['1 identity verification', '1 wallet registration', '1 tokenized property'],
    is_popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price_monthly: 49,
    price_annual: 490,
    description: 'Best value for owners building a small portfolio.',
    features: ['3 identity verifications', '3 wallet registrations', 'Priority support'],
    is_popular: true,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    price_monthly: 99,
    price_annual: 990,
    description: 'Expanded protection, unlimited tokenization, and API access.',
    features: ['Unlimited tokenization', '10 wallet registrations', 'White-label certificates'],
    is_popular: false,
  },
];

const MembershipModal = ({ isOpen, onClose, onPurchase }: MembershipModalProps) => {
  const { data: tiers } = useMembershipTiers();
  const visibleTiers = tiers?.length ? tiers : fallbackTiers;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Accountabul Membership Required
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <p className="text-center text-muted-foreground">
            You must be an Accountabul Member to tokenize property or invest in real estate.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {visibleTiers.map((tier) => (
              <div
                key={tier.id}
                className={cn(
                  'relative rounded-xl border bg-card p-4 text-left',
                  tier.is_popular ? 'border-primary shadow-card' : 'border-border'
                )}
              >
                {tier.is_popular && (
                  <div className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-bold text-foreground">${tier.price_monthly}</span>
                  <span className="text-sm text-muted-foreground mb-1">/mo</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${tier.price_annual?.toFixed(0)}/year
                </p>
                <p className="text-sm text-muted-foreground mt-3 min-h-10">{tier.description}</p>
                <ul className="mt-4 space-y-2">
                  {(tier.features ?? []).slice(0, 3).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Button 
              onClick={onPurchase}
              className="w-full" 
              variant="hero" 
              size="lg"
            >
              View Membership Plans
            </Button>
            <Button 
              onClick={onClose}
              variant="outline" 
              className="w-full"
            >
              Learn More
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MembershipModal;
