import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Play, Square } from 'lucide-react';
import type { DebateMode, DebateParams } from '@/hooks/useDebateSession';

interface Props {
  params: DebateParams;
  onChange: (p: DebateParams) => void;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
}

const DebateControls = ({ params, onChange, running, onStart, onStop }: Props) => (
  <div className="space-y-4 p-6 border rounded-lg bg-card">
    <div className="space-y-2">
      <Label htmlFor="topic">Topic / Question</Label>
      <Textarea
        id="topic"
        placeholder="e.g. Should we tokenize this property as MPT or NFT? What are the tradeoffs?"
        value={params.topic}
        onChange={e => onChange({ ...params, topic: e.target.value })}
        rows={3}
        disabled={running}
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Mode</Label>
        <Select
          value={params.mode}
          onValueChange={v => onChange({ ...params, mode: v as DebateMode })}
          disabled={running}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="debate">Debate — challenge each other</SelectItem>
            <SelectItem value="collaborate">Collaborate — build on each other</SelectItem>
            <SelectItem value="compare">Compare — independent views</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Rounds each</Label>
        <Select
          value={String(params.rounds)}
          onValueChange={v => onChange({ ...params, rounds: Number(v) })}
          disabled={running}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map(n => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="flex items-center gap-3">
      {running ? (
        <Button variant="destructive" onClick={onStop} className="gap-2">
          <Square className="w-4 h-4" /> Stop
        </Button>
      ) : (
        <Button
          onClick={onStart}
          disabled={!params.topic.trim()}
          className="gap-2"
        >
          <Play className="w-4 h-4" /> Start
        </Button>
      )}
      {running && (
        <p className="text-sm text-muted-foreground animate-pulse">
          Agents are discussing…
        </p>
      )}
    </div>
  </div>
);

export default DebateControls;
