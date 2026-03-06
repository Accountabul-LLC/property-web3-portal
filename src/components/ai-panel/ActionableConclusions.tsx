import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Lightbulb, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import type { DebateTurnData } from '@/hooks/useDebateSession';

interface ActionItem {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface Props {
  topic: string;
  turns: DebateTurnData[];
}

const priorityStyles = {
  high: 'border-l-destructive bg-destructive/5',
  medium: 'border-l-primary bg-primary/5',
  low: 'border-l-muted-foreground bg-muted/30',
};

const ActionableConclusions = ({ topic, turns }: Props) => {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const transcript = turns
        .filter(t => !t.streaming)
        .map(t => `[${t.speaker.toUpperCase()}]: ${t.text}`)
        .join('\n\n');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-debate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic,
            mode: 'conclude',
            history: [],
            round: 1,
            turnOffset: 0,
            transcript_summary: transcript,
          }),
        }
      );

      if (!res.ok) throw new Error('Failed to generate conclusions');

      let buffer = '';
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }

      // Parse all lines, extract the final full text
      const lines = buffer.split('\n').filter(l => l.trim());
      let fullText = '';
      for (const line of lines) {
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'turn_end' && ev.full_text) fullText = ev.full_text;
          if (ev.type === 'chunk' && ev.text) fullText += ev.text;
        } catch { /* skip */ }
      }

      // Parse action items from the text
      const parsed = parseActions(fullText || buffer);
      setActions(parsed);
      setGenerated(true);
    } catch (e) {
      console.error('Failed to generate conclusions:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!generated && (
        <Button onClick={generate} disabled={loading} variant="outline" className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
          {loading ? 'Generating action items…' : 'Generate Action Items'}
        </Button>
      )}

      {actions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Recommended Next Steps
          </h3>
          {actions.map((action, i) => (
            <Card key={i} className={`p-4 border-l-4 ${priorityStyles[action.priority]}`}>
              <div className="flex items-start gap-3">
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.description}</p>
                  <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {action.priority} priority
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

function parseActions(text: string): ActionItem[] {
  // Try to extract numbered items like "1. **Title**: description"
  const lines = text.split('\n').filter(l => l.trim());
  const items: ActionItem[] = [];

  for (const line of lines) {
    const match = line.match(/^\d+[\.\)]\s*\*{0,2}(.+?)\*{0,2}\s*[:\-–]\s*(.+)/);
    if (match) {
      const title = match[1].trim();
      const desc = match[2].trim();
      const priority: 'high' | 'medium' | 'low' =
        items.length === 0 ? 'high' : items.length < 3 ? 'medium' : 'low';
      items.push({ title, description: desc, priority });
    }
  }

  // Fallback: if no structured items found, create one from the whole text
  if (items.length === 0 && text.trim()) {
    items.push({
      title: 'Review debate conclusions',
      description: text.slice(0, 300),
      priority: 'medium',
    });
  }

  return items.slice(0, 5);
}

export default ActionableConclusions;
