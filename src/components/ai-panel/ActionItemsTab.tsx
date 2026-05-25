import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { callAdminEdgeFunction } from '@/lib/adminEdge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';
import { Github, Trash2, Loader2, ExternalLink, FileCode, ChevronDown, LayoutDashboard } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface ActionItemRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  files_json: any;
  expected_outcome: string | null;
  github_issue_url: string | null;
  github_issue_number: number | null;
  github_sync_status: string | null;
  source_type: string;
  created_at: string;
}

const STATUS_OPTIONS = ['open', 'in_progress', 'blocked', 'done', 'archived'] as const;
const FILTER_OPTIONS = ['all', 'open', 'in_progress', 'done'] as const;

const priorityVariant: Record<string, 'destructive' | 'default' | 'secondary'> = {
  HIGH: 'destructive',
  MEDIUM: 'default',
  LOW: 'secondary',
};

const statusColor: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  blocked: 'bg-red-500/10 text-red-600 border-red-500/20',
  done: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  archived: 'bg-muted text-muted-foreground border-border',
};

interface Props {
  refreshKey?: number;
}

export default function ActionItemsTab({ refreshKey }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ActionItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('all');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('action_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setItems((data as ActionItemRow[]) || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load action items');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  const updateStatus = async (id: string, newStatus: string) => {
    setBusyIds(prev => new Set(prev).add(id));
    try {
      const { success } = await callAdminEdgeFunction<{ success: boolean }>('action-item-admin', {
        action: 'update_status',
        id,
        status: newStatus,
      });
      if (!success) throw new Error('Failed to update status');
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
      toast.success(`Status → ${newStatus.replace('_', ' ')}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const deleteItem = async (id: string) => {
    setBusyIds(prev => new Set(prev).add(id));
    try {
      const { success } = await callAdminEdgeFunction<{ success: boolean }>('action-item-admin', {
        action: 'delete',
        id,
      });
      if (!success) throw new Error('Failed to delete');
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Item deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const pushToGithub = async (item: ActionItemRow) => {
    setBusyIds(prev => new Set(prev).add(item.id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const files = Array.isArray(item.files_json) ? item.files_json : [];
      const fileSection = files.length
        ? `\n### Relevant Files\n${files.map((f: string) => `- \`${f}\``).join('\n')}\n`
        : '';
      const outcomeSection = item.expected_outcome
        ? `\n### Expected Outcome\n${item.expected_outcome}\n`
        : '';
      const body = `## ${item.title}\n\n${item.description}${fileSection}${outcomeSection}\n---\n*Priority: ${item.priority} · Source: ${item.source_type}*`;

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
            title: item.title,
            body,
            labels: [`priority:${item.priority.toLowerCase()}`, 'ai-generated'],
          }),
        }
      );

      if (!res.ok) throw new Error('GitHub push failed');
      const data = await res.json();

      await callAdminEdgeFunction('action-item-admin', {
        action: 'sync_github',
        id: item.id,
        github_issue_url: data.url,
        github_issue_number: data.number,
        github_sync_status: 'synced',
        github_repo: 'JibreelMuhammad/property-web3-portal',
        pushed_at: new Date().toISOString(),
      });

      setItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? { ...i, github_issue_url: data.url, github_issue_number: data.number, github_sync_status: 'synced' }
            : i
        )
      );
      toast.success('Pushed to GitHub');
    } catch {
      toast.error('Failed to push to GitHub');
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  const parseFiles = (json: any): string[] => {
    if (Array.isArray(json)) return json;
    if (typeof json === 'string') {
      try { return JSON.parse(json); } catch { return []; }
    }
    return [];
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Action Items</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/action-items')}
            className="text-xs gap-1.5"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Task Dashboard
          </Button>
        </div>
        <div className="flex gap-1">
          {FILTER_OPTIONS.map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize text-xs"
            >
              {f.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        )}

        {!loading && items.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground text-sm">No action items yet. Run a debate and generate action items to see them here.</p>
          </Card>
        )}

        {!loading && items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>GitHub</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                const busy = busyIds.has(item.id);
                const files = parseFiles(item.files_json);
                return (
                  <TableRow key={item.id} className={busy ? 'opacity-50 pointer-events-none' : ''}>
                    <TableCell>
                      <p className="font-medium text-sm">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant[item.priority] || 'secondary'} className="text-[10px]">
                        {item.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${statusColor[item.status] || ''}`}>
                            {item.status.replace('_', ' ')}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {STATUS_OPTIONS.map(s => (
                            <DropdownMenuItem key={s} onClick={() => updateStatus(item.id, s)} className="capitalize text-xs">
                              {s.replace('_', ' ')}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      {files.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {files.slice(0, 2).map((f, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                              <FileCode className="w-2.5 h-2.5" />
                              {String(f).split('/').pop()}
                            </span>
                          ))}
                          {files.length > 2 && <span className="text-[10px] text-muted-foreground">+{files.length - 2}</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.github_issue_url ? (
                        <a href={item.github_issue_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="w-3 h-3" />#{item.github_issue_number}
                        </a>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => pushToGithub(item)} className="gap-1 text-xs h-7 px-2">
                          <Github className="w-3 h-3" /> Push
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
