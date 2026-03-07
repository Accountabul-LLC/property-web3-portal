import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Save, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import ChatInputBar from './ChatInputBar';
import DebateTurn from './DebateTurn';
import ActionableConclusions from './ActionableConclusions';
import { useDebateSession, type DebateParams } from '@/hooks/useDebateSession';
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

const AIPanel = ({ loadedSession, onSaved, selectedFiles = [] }: Props) => {
  const [params, setParams] = useState<DebateParams>(DEFAULT_PARAMS);
  const { turns, running, error, currentRound, awaitingUserInput, sessionId, start, continueRound, stop, saveSession, reset, loadTranscript } = useDebateSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [viewingHistory, setViewingHistory] = useState(false);

  const sessionActive = running || awaitingUserInput || (turns.length > 0 && !viewingHistory);

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

  const isDone = !running && !awaitingUserInput && turns.length > 0;

  const handleSend = (message: string) => {
    if (!sessionActive || viewingHistory) {
      // Start new session
      setViewingHistory(false);
      start({ ...params, topic: message, selectedFiles });
    } else if (awaitingUserInput || isDone) {
      // Continue with user message (mid-debate or after completion)
      continueRound(message);
    }
  };

  const handleSave = async () => {
    await saveSession(params);
    toast.success('Conversation saved');
    onSaved?.();
  };

  const handleNewChat = () => {
    reset();
    setParams(DEFAULT_PARAMS);
    setViewingHistory(false);
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


  return (
    <div className="flex flex-col h-full">
      {/* Scrollable conversation area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
          {/* Empty state */}
          {turns.length === 0 && !viewingHistory && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MessageSquarePlus className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">AI Panel</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Claude, ChatGPT, and Gemini discuss your question in turns. Use the settings gear to choose mode and rounds before sending.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              {error}
            </div>
          )}

          {viewingHistory && turns.length > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border">
              Viewing saved session · <button onClick={handleNewChat} className="underline hover:text-foreground">Start new</button>
            </div>
          )}

          {turns.map((turn, i) => (
            <DebateTurn key={`${turn.speaker}-${turn.turn}-${i}`} turn={turn} roundNumber={getRound(i)} />
          ))}

          {awaitingUserInput && (
            <div className="text-xs text-center text-muted-foreground py-2">
              Round {currentRound} / {params.rounds} complete — type below to add context or it will auto-continue
            </div>
          )}

          {/* Post-debate actions */}
          {isDone && !viewingHistory && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleSave} className="gap-2">
                  <Save className="w-4 h-4" /> Save
                </Button>
                <Button variant="ghost" size="sm" onClick={handleNewChat} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> New Chat
                </Button>
              </div>
              <ActionableConclusions topic={params.topic} turns={turns} sessionId={sessionId ?? undefined} />
            </div>
          )}

          {isDone && viewingHistory && (
            <ActionableConclusions topic={params.topic} turns={turns} sessionId={sessionId ?? undefined} />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Fixed bottom input bar */}
      {!viewingHistory && (
        <ChatInputBar
          params={params}
          onChange={setParams}
          running={running}
          sessionActive={turns.length > 0}
          awaitingInput={awaitingUserInput}
          isDone={isDone}
          onSend={handleSend}
          onStop={stop}
        />
      )}
    </div>
  );
};

export default AIPanel;
