import { ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { VerificationSource } from '@/hooks/useProfileVerifications';

interface VerifiedBadgeProps {
  source: VerificationSource;
  verifiedAt?: string;
  className?: string;
}

const SOURCE_LABELS: Record<VerificationSource, string> = {
  stripe_identity: 'Verified by ID check',
  kyc_review: 'Verified by admin review',
  oauth_google: 'Verified via Google sign-in',
  vendor_intake: 'Verified from vendor intake',
};

export function VerifiedBadge({ source, verifiedAt, className = '' }: VerifiedBadgeProps) {
  const label = SOURCE_LABELS[source];
  const dateStr = verifiedAt ? new Date(verifiedAt).toLocaleDateString() : null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium text-primary ${className}`}
            aria-label={label}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}{dateStr ? ` · ${dateStr}` : ''}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default VerifiedBadge;
