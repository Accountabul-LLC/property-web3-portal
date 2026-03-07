import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Github, FileCode, ArrowRight, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import type { DebateTurnData } from '@/hooks/useDebateSession';

export interface ActionItem {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  files?: string[];
  expected_outcome?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
  turns: DebateTurnData[];
  sessionId?: string;
}

const priorityVariant: Record<string, 'destructive' | 'default' | 'secondary'> = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
};

export default function ActionItemsPreviewModal({ open, onOpenChange, topic, turns, sessionId }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    if (open && items.length === 0 && !loading) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Build full conversation messages from turns
      const conversationMessages = turns
        .filter(t => !t.streaming)
        .map(t => ({
          role: t.speaker === 'user' ? 'user' as const : 'agent' as const,
          speaker: t.speaker,
          content: t.text,
        }));

      // Also build fallback transcript_summary
      const transcript = conversationMessages
        .map(m => `[${(m.speaker || m.role).toUpperCase()}]: ${m.content}`)
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
            conversation_messages: conversationMessages,
            transcript_summary: transcript,
            thread_id: sessionId,
          }),
        }
      );

      if (!res.ok) throw new Error('Failed to generate');

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

      for (const line of lines) {
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'conclude_result' && Array.isArray(ev.action_items)) {
            parsed = ev.action_items.map((item: any) => ({
              title: item.title || 'Untitled task',
              description: item.description || '',
              priority: (item.priority || 'MEDIUM').toLowerCase() as ActionItem['priority'],
              files: item.files || [],
              expected_outcome: item.expected_outcome || '',
            }));
            break;
          }
        } catch { /* skip */ }
      }

      if (parsed.length === 0) {
        let fullText = '';
        for (const line of lines) {
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'turn_end' && ev.full_text) fullText = ev.full_text;
            if (ev.type === 'chunk' && ev.text) fullText += ev.text;
          } catch { /* skip */ }
        }
        parsed = parseFallback(fullText || buffer);
      }

      const final = parsed.slice(0, 8);
      setItems(final);
      setSelected(new Set(final.map((_, i) => i)));
    } catch (e) {
      console.error('Failed to generate conclusions:', e);
      toast.error('Failed to generate action items');
    } finally {
      setLoading(false);
    }
  };

  const [saved, setSaved] = useState(false);

  const saveSelected = async () => {
    const indices = Array.from(selected);
    if (indices.length === 0) { toast.error('Select at least one item'); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const selectedItems = indices.map(i => items[i]);
      const rows = selectedItems.map(item => ({
        created_by: session.user.id,
        source_thread_id: sessionId || null,
        source_type: 'debate',
        title: item.title,
        description: item.description,
        priority: item.priority.toUpperCase(),
        files_json: JSON.stringify(item.files || []),
        expected_outcome: item.expected_outcome || '',
        status: 'open',
        github_sync_status: 'none',
      }));
      const { error } = await supabase.from('action_items' as any).insert(rows as any);
      if (error) throw error;
      setSaved(true);
      toast.success(`${selectedItems.length} action items saved`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save action items');
    } finally {
      setSaving(false);
    }
  };

  const insertAndGetIds = async (userId: string) => {
    const indices = Array.from(selected);
    const selectedItems = indices.map(i => items[i]);
    const rows = selectedItems.map(item => ({
      created_by: userId,
      source_thread_id: sessionId || null,
      source_type: 'debate',
      title: item.title,
      description: item.description,
      priority: item.priority.toUpperCase(),
      files_json: JSON.stringify(item.files || []),
      expected_outcome: item.expected_outcome || '',
      status: 'open',
      github_sync_status: 'none',
    }));
    const { data, error } = await supabase.from('action_items' as any).insert(rows as any).select('id');
    if (error) throw error;
    return { ids: data as any[] | null, items: selectedItems };
  };

  const buildIssueBody = (action: ActionItem): string => {
    const sections: string[] = [
      `## Context`,
      `Generated from **debate** session via AI Panel.`,
      ``,
      `## Problem`,
      action.description || '_No description provided._',
      ``,
    ];
    if (action.files?.length) {
      sections.push(`## Files Involved`, ...action.files.map(f => `- \`${f}\``), ``);
    }
    if (action.expected_outcome) {
      sections.push(`## Expected Outcome`, action.expected_outcome, ``);
    }
    sections.push(
      `## Acceptance Criteria`,
      `- [ ] Implementation complete`,
      `- [ ] Tests pass`,
      `- [ ] Reviewed and approved`,
      ``,
      `---`,
      `*Priority: ${action.priority} · Generated from AI Panel debate*`,
    );
    return sections.join('\n');
  };

  const getLabelsForItem = (action: ActionItem): string[] => {
    const labels = ['ai-generated', 'action-item'];
    const p = action.priority.toUpperCase();
    if (p === 'HIGH') labels.push('high-priority');
    labels.push('agent-debate');
    const files = action.files || [];
    if (files.some(f => f.startsWith('src/'))) labels.push('frontend');
    if (files.some(f => f.startsWith('supabase/'))) labels.push('backend');
    return labels;
  };

  const pushSelected = async () => {
    const indices = Array.from(selected);
    if (indices.length === 0) {
      toast.error('Select at least one item');
      return;
    }
    setPushing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const savedRows = await insertActionItems(session.user.id);

      let pushed = 0;
      for (const idx of indices) {
        const action = items[idx];
        const dbRow = savedRows?.[idx];
        try {
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
                title: `[${action.priority.toUpperCase()}] ${action.title}`,
                body: buildIssueBody(action),
                labels: getLabelsForItem(action),
              }),
            }
          );
          if (!res.ok) continue;
          const data = await res.json();

          if (dbRow?.id && data.url) {
            await (supabase.from('action_items' as any) as any)
              .update({ github_issue_url: data.url, github_issue_number: data.number, github_sync_status: 'synced' })
              .eq('id', dbRow.id);
          }
          pushed++;
        } catch { /* continue */ }
      }

      toast.success(`Saved ${items.length} items, pushed ${pushed} to GitHub`);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to push to GitHub');
    } finally {
      setPushing(false);
    }
  };

  const toggleItem = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const busy = saving || pushing;

  return (
    <Dialog open={open} onOpenChange={busy ? () => {} : onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Action Items Preview</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {loading && (
            <>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
              <p className="text-xs text-muted-foreground text-center">Generating action items…</p>
            </>
          )}

          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No action items generated.</p>
          )}

          {!loading && items.map((item, i) => (
            <Card
              key={i}
              className={`p-3 cursor-pointer transition-colors ${selected.has(i) ? 'border-primary/50 bg-primary/5' : ''}`}
              onClick={() => toggleItem(i)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected.has(i)}
                  onCheckedChange={() => toggleItem(i)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{item.title}</p>
                    <Badge variant={priorityVariant[item.priority]} className="text-[10px] uppercase">
                      {item.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>

                  {item.files && item.files.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.files.map((f, fi) => (
                        <span key={fi} className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                          <FileCode className="w-2.5 h-2.5" />
                          {f.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.expected_outcome && (
                    <p className="text-[11px] text-muted-foreground/70 mt-1 italic flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      {item.expected_outcome}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {!loading && items.length > 0 && (
          <DialogFooter className="gap-2 sm:gap-2">
            {autoSaved && <span className="text-xs text-muted-foreground mr-auto">✓ Auto-saved</span>}
            <Button
              variant="outline"
              onClick={() => { onOpenChange(false); navigate('/action-items'); }}
              disabled={busy}
              className="gap-2"
            >
              <ListChecks className="w-4 h-4" /> View Task List
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Dismiss
            </Button>
            <Button onClick={pushSelected} disabled={busy || selected.size === 0} variant="hero" className="gap-2">
              {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
              Push {selected.size} to GitHub
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseFallback(text: string): ActionItem[] {
  const lines = text.split('\n');
  const items: ActionItem[] = [];
  let currentTitle = '';
  let currentDesc = '';

  const flush = () => {
    if (currentTitle) {
      const priority: ActionItem['priority'] =
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
    items.push({ title: 'Review debate conclusions', description: text.slice(0, 500), priority: 'medium' });
  }
  return items.slice(0, 8);
}
