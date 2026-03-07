import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw, Save, ArrowRight, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import DebateControls from './DebateControls';
import DebateTurn from './DebateTurn';
import ActionableConclusions from './ActionableConclusions';
import { useDebateSession, type DebateParams, type DebateTurnData } from '@/hooks/useDebateSession';
import type { SavedSession } from './SessionSidebar';

const DEFAULT_PARAMS: DebateParams = {
  topic: '',
  mode: 'debate',
  rounds: 3,
};

interface Props {
  loadedSession?: SavedSession | null;
  onSaved?: () => void;
  selectedFiles?: string[];
}

const AIPanel = ({ loadedSession, onSaved }: Props) => {
  const [params, setParams] = useState<DebateParams>(DEFAULT_PARAMS);
  const [userInput, setUserInput] = useState('');
  const { turns, running, error, currentRound, awaitingUserInput, start, continueRound, stop, saveSession, reset, loadTranscript } = useDebateSession();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [viewingHistory, setViewingHistory] = useState(false);

  // Load a saved session when selected from sidebar
  useEffect(() => {
    if (loadedSession) {
      setParams({ topic: loadedSession.topic, mode: loadedSession.mode as any, rounds: loadedSession.rounds });
      loadTranscript(loadedSession.transcript as any[]);
      setViewingHistory(true);
    } else {
      reset();
      setParams(DEFAULT_PARAMS);
      setViewingHistory(false);
    }
  }, [loadedSession?.id]);

  // Auto-scroll as turns appear
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, awaitingUserInput]);

  const handleStart = () => {
    setViewingHistory(false);
    start(params);
  };

  const handleContinue = () => {
    const msg = userInput.trim();
    setUserInput('');
    continueRound(msg || undefined);
  };

  const handleSkip = () => {
    setUserInput('');
    continueRound();
  };

  const handleSave = async () => {
    await saveSession(params);
    toast.success('Conversation saved');
    onSaved?.();
  };

  const getRound = (turnIndex: number) => {
    let round = 1;
    let aiCount = 0;
    for (let i = 0; i <= turnIndex; i++) {
      if (turns[i]?.speaker !== 'user') {
        aiCount++;
        round = Math.ceil(aiCount / 2);
      }
    }
    return round;
  };

  const isDone = !running && !awaitingUserInput && turns.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8 px-4">
      <div>
        <h2 className="text-2xl font-bold mb-1">AI Panel</h2>
        <p className="text-muted-foreground text-sm">
          Claude and ChatGPT discuss your question in turns. You can inject messages between rounds.
        </p>
      </div>

      {!viewingHistory && (
        <DebateControls
          params={params}
          onChange={setParams}
          running={running || awaitingUserInput}
          onStart={handleStart}
          onStop={stop}
        />
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          {error}
        </div>
      )}

      {turns.length > 0 && (
        <div className="space-y-4">
          {viewingHistory && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border">
              Viewing saved session · <button onClick={() => { reset(); setViewingHistory(false); }} className="underline hover:text-foreground">Start new</button>
            </div>
          )}

          {turns.map((turn, i) => (
            <DebateTurn key={`${turn.speaker}-${turn.turn}-${i}`} turn={turn} roundNumber={getRound(i)} />
          ))}

          {awaitingUserInput && (
            <div className="rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Round {currentRound} complete — your turn
                </p>
                <span className="text-xs text-muted-foreground">
                  {currentRound} / {params.rounds} rounds done
                </span>
              </div>
              <Textarea
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                placeholder="Add context, redirect the discussion, or ask a follow-up question…"
                className="min-h-[80px] resize-none bg-white dark:bg-background"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleContinue();
                }}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleContinue} className="gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Send & Continue
                </Button>
                <Button size="sm" variant="outline" onClick={handleSkip} className="gap-1.5">
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip
                </Button>
                <span className="text-xs text-muted-foreground ml-1">⌘↵ to send</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {isDone && !viewingHistory && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" /> Save Conversation
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Reset
            </Button>
          </div>

          <ActionableConclusions topic={params.topic} turns={turns} />
        </div>
      )}

      {isDone && viewingHistory && (
        <ActionableConclusions topic={params.topic} turns={turns} />
      )}
    </div>
  );
};

export default AIPanel;
