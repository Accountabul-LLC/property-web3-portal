import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { DebateTurnData } from '@/hooks/useDebateSession';

const SPEAKER_CONFIG = {
  claude: {
    label: 'Claude',
    subtitle: 'claude-sonnet-4-6',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    avatar: 'bg-amber-500 text-white',
    initial: 'C',
  },
  gpt: {
    label: 'ChatGPT',
    subtitle: 'gpt-4o',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    avatar: 'bg-emerald-500 text-white',
    initial: 'G',
  },
} as const;

interface Props {
  turn: DebateTurnData;
  roundNumber: number;
}

const DebateTurn = ({ turn, roundNumber }: Props) => {
  const [copied, setCopied] = useState(false);
  const cfg = SPEAKER_CONFIG[turn.speaker];

  const copy = async () => {
    await navigator.clipboard.writeText(turn.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn('rounded-lg border p-5 space-y-3 group', cfg.bg, cfg.border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold', cfg.avatar)}>
            {cfg.initial}
          </div>
          <div>
            <span className="font-semibold text-sm">{cfg.label}</span>
            <span className="text-xs text-muted-foreground ml-2">{cfg.subtitle}</span>
          </div>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.badge)}>
            Round {roundNumber}
          </span>
        </div>

        {!turn.streaming && turn.text && (
          <button
            onClick={copy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-black/10"
            aria-label="Copy message"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          </button>
        )}
      </div>

      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {turn.text}
        {turn.streaming && (
          <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  );
};

export default DebateTurn;
