import { Copy, Check, User } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { DebateTurnData } from '@/hooks/useDebateSession';

const AI_SPEAKER_CONFIG = {
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
  gemini: {
    label: 'Gemini',
    subtitle: 'gemini-3-flash-preview',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    avatar: 'bg-blue-500 text-white',
    initial: 'G✦',
  },
} as const;

interface Props {
  turn: DebateTurnData;
  roundNumber: number;
}

const DebateTurn = ({ turn, roundNumber }: Props) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(turn.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // User injection message — distinct style
  if (turn.speaker === 'user') {
    return (
      <div className="flex items-start gap-3 px-2 py-3">
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">You · Round {roundNumber}</span>
          <p className="text-sm mt-0.5 leading-relaxed">{turn.text}</p>
        </div>
      </div>
    );
  }

  const cfg = AI_SPEAKER_CONFIG[turn.speaker as keyof typeof AI_SPEAKER_CONFIG] ?? {
    label: turn.speaker,
    subtitle: '',
    bg: 'bg-muted/30',
    border: 'border-border',
    badge: 'bg-muted text-muted-foreground',
    avatar: 'bg-muted-foreground text-background',
    initial: (turn.speaker?.[0] ?? '?').toUpperCase(),
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
