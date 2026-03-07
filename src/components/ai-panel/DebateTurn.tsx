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
    avatar: 'bg-amber-500 text-white',
    initial: 'C',
  },
  gpt: {
    label: 'ChatGPT',
    subtitle: 'gpt-4o',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    avatar: 'bg-emerald-500 text-white',
    initial: 'G',
  },
  gemini: {
    label: 'Gemini',
    subtitle: 'gemini-3-flash-preview',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
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

  // User message — right-aligned bubble
  if (turn.speaker === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] flex items-start gap-2">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5">
            <p className="text-sm leading-relaxed">{turn.text}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-primary/80 flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        </div>
      </div>
    );
  }

  const cfg = AI_SPEAKER_CONFIG[turn.speaker as keyof typeof AI_SPEAKER_CONFIG] ?? {
    label: turn.speaker,
    subtitle: '',
    bg: 'bg-muted/30',
    border: 'border-border',
    avatar: 'bg-muted-foreground text-background',
    initial: (turn.speaker?.[0] ?? '?').toUpperCase(),
  };

  return (
    <div className="flex items-start gap-3 group">
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1', cfg.avatar)}>
        {cfg.initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{cfg.label}</span>
          <span className="text-[10px] text-muted-foreground">{cfg.subtitle}</span>
        </div>
        <div className={cn('rounded-2xl rounded-tl-md border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap', cfg.bg, cfg.border)}>
          {turn.text}
          {turn.streaming && (
            <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />
          )}
        </div>
        {!turn.streaming && turn.text && (
          <button
            onClick={copy}
            className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Copy message"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default DebateTurn;
