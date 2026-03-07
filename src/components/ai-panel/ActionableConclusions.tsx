import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Lightbulb, Loader2, CheckCircle2, ArrowRight, Github, ExternalLink, FileCode } from 'lucide-react';
import type { DebateTurnData } from '@/hooks/useDebateSession';

interface ActionItem {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  files?: string[];
  expected_outcome?: string;
  issueUrl?: string;
  creating?: boolean;
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

      const lines = buffer.split('\n').filter(l => l.trim());
      let parsed: ActionItem[] = [];

      // Try structured conclude_result first
      for (const line of lines) {
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'conclude_result' && Array.isArray(ev.action_items)) {
            parsed = ev.action_items.map((item: any) => ({
              title: item.title || 'Untitled task',
              description: item.description || '',
              priority: (item.priority || 'MEDIUM').toLowerCase() as 'high' | 'medium' | 'low',
              files: item.files || [],
              expected_outcome: item.expected_outcome || '',
            }));
            break;
          }
        } catch { /* skip */ }
      }

      // Fallback: parse freeform text from debate-style response
      if (parsed.length === 0) {
        let fullText = '';
        for (const line of lines) {
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'turn_end' && ev.full_text) fullText = ev.full_text;
            if (ev.type === 'chunk' && ev.text) fullText += ev.text;
          } catch { /* skip */ }
        }
        parsed = parseActions(fullText || buffer);
      }

      setActions(parsed.slice(0, 8));
      setGenerated(true);
    } catch (e) {
      console.error('Failed to generate conclusions:', e);
    } finally {
      setLoading(false);
    }
  };

  const buildIssueBody = (action: ActionItem): string => {
    const speakers = [...new Set(turns.filter(t => !t.streaming).map(t => t.speaker))];
    const participantList = speakers.map(s => s === 'user' ? 'User' : s.toUpperCase()).join(', ');

    const completedTurns = turns.filter(t => !t.streaming && t.text.trim());
    let transcript = '';
    for (let i = completedTurns.length - 1; i >= 0; i--) {
      const t = completedTurns[i];
      const label = t.speaker === 'user' ? 'User' : t.speaker.toUpperCase();
      const entry = `**${label}:** ${t.text}\n\n`;
      if ((transcript.length + entry.length) > 3000) break;
      transcript = entry + transcript;
    }

    const fileSection = action.files?.length
      ? `\n### Relevant Files\n${action.files.map(f => `- \`${f}\``).join('\n')}\n`
      : '';

    const outcomeSection = action.expected_outcome
      ? `\n### Expected Outcome\n${action.expected_outcome}\n`
      : '';

    return [
      `## Action Item: ${action.title}`,
      '',
      action.description,
      fileSection,
      outcomeSection,
      '### Debate Context',
      '',
      `**Topic:** ${topic}`,
      `**Participants:** ${participantList}`,
      '',
      '#### Key Discussion Points',
      '',
      transcript.trim(),
      '',
      '---',
      `*Priority: ${action.priority}*`,
      '*Generated from AI Panel debate*',
    ].join('\n');
  };

  const createIssue = async (index: number) => {
    const action = actions[index];
    if (!action || action.issueUrl || action.creating) return;

    setActions(prev => prev.map((a, i) => i === index ? { ...a, creating: true } : a));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body = buildIssueBody(action);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-agent`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create_issue',
            owner: 'JibreelMuhammad',
            repo: 'property-web3-portal',
            title: action.title,
            body,
            labels: [`priority:${action.priority}`, 'ai-generated'],
          }),
        }
      );

      if (!res.ok) throw new Error('Failed to create issue');
      const data = await res.json();

      setActions(prev => prev.map((a, i) =>
        i === index ? { ...a, issueUrl: data.url, creating: false } : a
      ));
    } catch (e) {
      console.error('Failed to create GitHub issue:', e);
      setActions(prev => prev.map((a, i) =>
        i === index ? { ...a, creating: false } : a
      ));
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
            Recommended Next Steps ({actions.length} items)
          </h3>
          {actions.map((action, i) => (
            <Card key={i} className={`p-4 border-l-4 ${priorityStyles[action.priority]}`}>
              <div className="flex items-start gap-3">
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.description}</p>

                  {action.files && action.files.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {action.files.map((f, fi) => (
                        <span key={fi} className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                          <FileCode className="w-2.5 h-2.5" />
                          {f.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  )}

                  {action.expected_outcome && (
                    <p className="text-[11px] text-muted-foreground/70 mt-1.5 italic">
                      → {action.expected_outcome}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {action.priority} priority
                    </span>
                    {action.issueUrl ? (
                      <a
                        href={action.issueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Issue
                      </a>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-2 text-[10px] gap-1"
                        onClick={() => createIssue(i)}
                        disabled={action.creating}
                      >
                        {action.creating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Github className="w-3 h-3" />
                        )}
                        {action.creating ? 'Creating…' : 'Create Issue'}
                      </Button>
                    )}
                  </div>
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
  const lines = text.split('\n');
  const items: ActionItem[] = [];
  let currentTitle = '';
  let currentDesc = '';

  const flush = () => {
    if (currentTitle) {
      const priority: 'high' | 'medium' | 'low' =
        items.length === 0 ? 'high' : items.length < 3 ? 'medium' : 'low';
      items.push({ title: currentTitle, description: currentDesc.trim(), priority });
    }
  };

  for (const line of lines) {
    const match = line.match(/^\d+[\.\)]\s*\*{0,2}(.+?)\*{0,2}\s*[:\-–]\s*(.*)/);
    if (match) {
      flush();
      currentTitle = match[1].trim();
      currentDesc = match[2]?.trim() || '';
    } else if (currentTitle && line.trim()) {
      currentDesc += (currentDesc ? ' ' : '') + line.trim();
    }
  }
  flush();

  if (items.length === 0 && text.trim()) {
    items.push({
      title: 'Review debate conclusions',
      description: text.slice(0, 500),
      priority: 'medium',
    });
  }

  return items.slice(0, 8);
}

export default ActionableConclusions;
