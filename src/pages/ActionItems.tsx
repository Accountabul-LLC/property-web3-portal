import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeamAccess } from '@/hooks/useTeamAccess';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Loader2, Github, Trash2, ExternalLink, FileCode,
  ChevronDown, Search, ListChecks, ArrowUpDown,
  AlertCircle, Clock, CheckCircle2, Filter,
} from 'lucide-react';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ActionItemRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  files_json: any;
  expected_outcome: string | null;
  source_type: string;
  source_thread_id: string | null;
  github_issue_url: string | null;
  github_issue_number: number | null;
  github_sync_status: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS = ['open', 'in_progress', 'blocked', 'done', 'archived'] as const;

type FilterPreset = 'all' | 'open' | 'in_progress' | 'done' | 'high_priority' | 'needs_push';

const FILTER_PRESETS: { key: FilterPreset; label: string; icon: React.ReactNode }[] = [
  { key: 'all',           label: 'All',            icon: <ListChecks className="w-3.5 h-3.5" /> },
  { key: 'open',          label: 'Open',           icon: <AlertCircle className="w-3.5 h-3.5" /> },
  { key: 'in_progress',   label: 'In Progress',    icon: <Clock className="w-3.5 h-3.5" /> },
  { key: 'done',          label: 'Done',           icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: 'high_priority', label: 'High Priority',  icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
  { key: 'needs_push',    label: 'Needs Push',     icon: <Github className="w-3.5 h-3.5" /> },
];

const priorityVariant: Record<string, 'destructive' | 'default' | 'secondary'> = {
  HIGH: 'destructive', MEDIUM: 'default', LOW: 'secondary',
};

const statusStyle: Record<string, string> = {
  open:        'bg-blue-500/10 text-blue-600 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  blocked:     'bg-red-500/10 text-red-600 border-red-500/20',
  done:        'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  archived:    'bg-muted text-muted-foreground border-border',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const parseFiles = (json: any): string[] => {
  if (Array.isArray(json)) return json;
  if (typeof json === 'string') { try { return JSON.parse(json); } catch { return []; } }
  return [];
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ActionItems() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useTeamAccess();

  const [items, setItems] = useState<ActionItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterPreset>('all');
  const [search, setSearch] = useState('');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Gate
  useEffect(() => {
    if (authLoading || accessLoading) return;
    if (!user) { navigate('/auth?tab=admin'); return; }
    if (!hasAccess) { navigate('/dashboard'); return; }
  }, [user, authLoading, hasAccess, accessLoading, navigate]);

  // Fetch
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('action_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data as ActionItemRow[]) || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load action items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Filtered view
  const filtered = items.filter(item => {
    if (filter === 'open' && item.status !== 'open') return false;
    if (filter === 'in_progress' && item.status !== 'in_progress') return false;
    if (filter === 'done' && item.status !== 'done') return false;
    if (filter === 'high_priority' && item.priority !== 'HIGH') return false;
    if (filter === 'needs_push' && item.github_sync_status !== 'none') return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Stats
  const stats = {
    total: items.length,
    open: items.filter(i => i.status === 'open').length,
    inProgress: items.filter(i => i.status === 'in_progress').length,
    done: items.filter(i => i.status === 'done').length,
    needsPush: items.filter(i => i.github_sync_status === 'none').length,
  };

  // Actions
  const updateStatus = async (id: string, newStatus: string) => {
    setBusyIds(prev => new Set(prev).add(id));
    try {
      const { error } = await supabase
        .from('action_items')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
      toast.success(`Status → ${newStatus.replace('_', ' ')}`);
    } catch { toast.error('Failed to update'); }
    finally { setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const deleteItem = async (id: string) => {
    setBusyIds(prev => new Set(prev).add(id));
    try {
      const { error } = await supabase.from('action_items').delete().eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Item deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const pushToGithub = async (item: ActionItemRow) => {
    setBusyIds(prev => new Set(prev).add(item.id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const files = parseFiles(item.files_json);
      const fileSection = files.length ? `\n### Relevant Files\n${files.map((f: string) => `- \`${f}\``).join('\n')}\n` : '';
      const outcomeSection = item.expected_outcome ? `\n### Expected Outcome\n${item.expected_outcome}\n` : '';
      const body = `## ${item.title}\n\n${item.description}${fileSection}${outcomeSection}\n---\n*Priority: ${item.priority} · Source: ${item.source_type}*`;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-agent`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_issue', owner: 'JibreelMuhammad', repo: 'property-web3-portal',
          title: item.title, body, labels: [`priority:${item.priority.toLowerCase()}`, 'ai-generated'],
        }),
      });
      if (!res.ok) throw new Error('GitHub push failed');
      const data = await res.json();

      await supabase.from('action_items').update({
        github_issue_url: data.url, github_issue_number: data.number, github_sync_status: 'synced',
      }).eq('id', item.id);

      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, github_issue_url: data.url, github_issue_number: data.number, github_sync_status: 'synced' } : i));
      toast.success('Pushed to GitHub');
    } catch { toast.error('Failed to push'); }
    finally { setBusyIds(prev => { const n = new Set(prev); n.delete(item.id); return n; }); }
  };

  // Loading gate
  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!hasAccess) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Action Items</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage tasks generated from AI debates and conversations</p>
          </div>
          <Link to="/admin/ai-panel">
            <Button variant="outline" size="sm" className="gap-2">
              <ListChecks className="w-4 h-4" /> Back to AI Panel
            </Button>
          </Link>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground' },
            { label: 'Open', value: stats.open, color: 'text-blue-600' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-amber-600' },
            { label: 'Done', value: stats.done, color: 'text-emerald-600' },
            { label: 'Needs Push', value: stats.needsPush, color: 'text-purple-600' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 flex-wrap">
            {FILTER_PRESETS.map(f => (
              <Button
                key={f.key}
                variant={filter === f.key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter(f.key)}
                className="gap-1.5 text-xs"
              >
                {f.icon} {f.label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Filter className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {items.length === 0
                  ? 'No action items yet. Generate them from the AI Panel.'
                  : 'No items match the current filters.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[280px]">Title</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-24">Source</TableHead>
                    <TableHead className="w-32">Files</TableHead>
                    <TableHead className="w-32">Created</TableHead>
                    <TableHead className="w-28">GitHub</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => {
                    const busy = busyIds.has(item.id);
                    const files = parseFiles(item.files_json);
                    return (
                      <TableRow key={item.id} className={busy ? 'opacity-50 pointer-events-none' : ''}>
                        <TableCell>
                          <p className="font-medium text-sm">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
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
                              <button className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${statusStyle[item.status] || ''}`}>
                                {item.status.replace('_', ' ')} <ChevronDown className="w-3 h-3" />
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
                          <span className="text-xs text-muted-foreground capitalize">{item.source_type}</span>
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
                          <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                        </TableCell>
                        <TableCell>
                          {item.github_issue_url ? (
                            <a href={item.github_issue_url} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <ExternalLink className="w-3 h-3" />#{item.github_issue_number}
                            </a>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => pushToGithub(item)} className="gap-1 text-xs h-7 px-2">
                              <Github className="w-3 h-3" /> Push
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
