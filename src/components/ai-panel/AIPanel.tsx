import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import DebateControls from './DebateControls';
import DebateTurn from './DebateTurn';
import { useDebateSession, type DebateParams } from '@/hooks/useDebateSession';

const DEFAULT_PARAMS: DebateParams = {
  topic: '',
  mode: 'debate',
  rounds: 3,
};

const AIPanel = () => {
  const [params, setParams] = useState<DebateParams>(DEFAULT_PARAMS);
  const { turns, running, error, start, stop, saveSession, reset } = useDebateSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleStart = () => {
    start(params);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSave = async () => {
    await saveSession(params);
    toast.success('Conversation saved');
  };

  // Compute round number for display: Claude turn 1 = round 1, GPT turn 1 = round 1, etc.
  const getRound = (turnIndex: number) => Math.floor(turnIndex / 2) + 1;

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8 px-4">
      <div>
        <h2 className="text-2xl font-bold mb-1">AI Panel</h2>
        <p className="text-muted-foreground text-sm">
          Claude and ChatGPT discuss your question in turns, in the context of this RWA platform.
        </p>
      </div>

      <DebateControls
        params={params}
        onChange={setParams}
        running={running}
        onStart={handleStart}
        onStop={stop}
      />

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          {error}
        </div>
      )}

      {turns.length > 0 && (
        <div className="space-y-4">
          {turns.map((turn, i) => (
            <DebateTurn key={`${turn.speaker}-${turn.turn}`} turn={turn} roundNumber={getRound(i)} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {turns.length > 0 && !running && (
        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" /> Save Conversation
          </Button>
          <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
        </div>
      )}
    </div>
  );
};

export default AIPanel;
