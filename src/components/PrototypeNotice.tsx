import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrototypeNoticeProps {
  /** "banner" spans the page width, "inline" fits inside a card or sidebar. */
  variant?: 'banner' | 'inline';
  className?: string;
  /** Optional extra sentence describing the specific screen. */
  children?: React.ReactNode;
}

export const PROTOTYPE_NOTICE_TEXT =
  'Hackathon prototype. This project is a work in progress and is not production ready. Accountabul is not a bank, broker, dealer, or custodian. Nothing here is an investment offer, and no return, yield, or liquidity is promised.';

/**
 * Reusable prototype disclosure shown on public-facing pages.
 * Wording is plain and factual on purpose.
 */
const PrototypeNotice: React.FC<PrototypeNoticeProps> = ({ variant = 'banner', className, children }) => {
  return (
    <aside
      role="note"
      aria-label="Hackathon prototype notice"
      className={cn(
        'border border-amber-500/40 bg-amber-500/10 text-foreground',
        variant === 'banner' ? 'rounded-lg px-4 py-3' : 'rounded-md px-3 py-2',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className={cn('space-y-1', variant === 'banner' ? 'text-sm' : 'text-xs')}>
          <p>
            <strong className="font-semibold">Hackathon prototype.</strong> {PROTOTYPE_NOTICE_TEXT.replace('Hackathon prototype. ', '')}
          </p>
          {children ? <p className="text-muted-foreground">{children}</p> : null}
        </div>
      </div>
    </aside>
  );
};

export default PrototypeNotice;
