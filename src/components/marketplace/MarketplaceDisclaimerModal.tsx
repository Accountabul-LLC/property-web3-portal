import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldAlert } from 'lucide-react';

const STORAGE_KEY = 'marketplace_disclaimer_ack_v1';

export function hasDismissedMarketplaceDisclaimer(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

interface Props {
  open: boolean;
  onAcknowledge: () => void;
}

export default function MarketplaceDisclaimerModal({ open, onAcknowledge }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (open) setDontShowAgain(false);
  }, [open]);

  const handleAcknowledge = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ackAt: new Date().toISOString() }));
      } catch {
        /* ignore */
      }
    }
    onAcknowledge();
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* must acknowledge to close */ }}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Before you browse the marketplace</DialogTitle>
          <DialogDescription className="text-center">
            Please read and acknowledge how this marketplace works.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Accountabul is a <span className="font-medium text-foreground">platform</span> that lets businesses and individuals
            post property listings. We are <span className="font-medium text-foreground">not a real estate broker, agent, or escrow service</span>.
          </p>
          <p>
            Listings may be <span className="font-medium text-foreground">Standard Listings</span> (regular property listings
            posted by third parties - <span className="font-medium text-foreground">not tokenized</span>) or
            {' '}<span className="font-medium text-foreground">Tokenized Properties</span> (on-chain fractional offerings).
          </p>
          <p>
            For Standard Listings, the lister could be anyone with a business profile. Always
            {' '}<span className="font-medium text-foreground">verify the person, the property, and the documents</span> before
            sending any money. Do your own due diligence.
          </p>
          <p>
            Accountabul is not responsible for the accuracy of listings, the conduct of listers or buyers,
            or any transaction that takes place off-platform.
          </p>
        </div>

        <label className="mt-4 flex items-start gap-2 rounded-md border p-3 text-sm">
          <Checkbox
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            className="mt-0.5"
          />
          <span>
            I understand and accept these terms. <span className="text-muted-foreground">Don't show this again.</span>
          </span>
        </label>

        <DialogFooter>
          <Button onClick={handleAcknowledge} className="w-full">
            I Understand - Continue to Marketplace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
