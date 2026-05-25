import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { callAdminEdgeFunction } from '@/lib/adminEdge';
import { useAuth } from '@/hooks/useAuth';
import { useAIAgents, type AIAgent } from '@/hooks/useAIAgents';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, GitBranch, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AgentIntegration {
  id: string;
  agent_id: string;
  integration_type: string;
  enabled: boolean;
  connected_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  agent_id: string | null;
  integration_type: string;
  action: string;
  actor_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export default function IntegrationsDashboard() {
  const { user } = useAuth();
  const { data: agents, isLoading: agentsLoading } = useAIAgents();
  const [integrations, setIntegrations] = useState<AgentIntegration[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [githubConnected, setGithubConnected] = useState(true);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [intRes, auditRes] = await Promise.all([
      supabase.from('agent_integrations' as any).select('*'),
      supabase.from('integration_audit_log' as any).select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    const ints = (intRes.data || []) as unknown as AgentIntegration[];
    setIntegrations(ints);
    setAuditLog((auditRes.data || []) as unknown as AuditEntry[]);

    // Derive global connection state: connected if any integration exists
    // We store this in a special "global" integration record with agent_id = '00000000-0000-0000-0000-000000000000'
    const globalRecord = ints.find(i => i.agent_id === '00000000-0000-0000-0000-000000000000' && i.integration_type === 'github');
    setGithubConnected(globalRecord ? globalRecord.enabled : true); // default to connected if no record
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = useCallback(async (agent: AIAgent, currentEnabled: boolean) => {
    if (!user) return;
    const newEnabled = !currentEnabled;
    setToggling(agent.id);

    try {
      await callAdminEdgeFunction('admin-integrations', {
        action: 'toggle',
        agent_id: agent.id,
        integration_type: 'github',
        enabled: newEnabled,
      });

      toast.success(`GitHub ${newEnabled ? 'enabled' : 'disabled'} for ${agent.name}`);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    } finally {
      setToggling(null);
    }
  }, [user, fetchData]);

  const handleGlobalToggle = useCallback(async () => {
    if (!user) return;
    const newConnected = !githubConnected;
    setTogglingGlobal(true);

    try {
      await callAdminEdgeFunction('admin-integrations', {
        action: 'global_toggle',
        integration_type: 'github',
        enabled: newConnected,
      });

      toast.success(`GitHub integration ${newConnected ? 'connected' : 'disconnected'}`);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    } finally {
      setTogglingGlobal(false);
    }
  }, [user, githubConnected, fetchData]);

  const getIntegration = (agentId: string) =>
    integrations.find((i) => i.agent_id === agentId && i.integration_type === 'github');

  const agentNameById = (id: string | null) => {
    if (!id) return 'System';
    return agents?.find((a) => a.id === id)?.name || id.slice(0, 8);
  };

  if (loading || agentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${githubConnected ? 'bg-primary/10' : 'bg-muted'}`}>
              <GitBranch className={`w-6 h-6 ${githubConnected ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">GitHub Integration</CardTitle>
              <CardDescription>JibreelMuhammad/property-web3-portal</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {githubConnected ? (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-destructive/30 text-destructive">
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Disconnected
                </Badge>
              )}
              {togglingGlobal ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <Switch checked={githubConnected} onCheckedChange={handleGlobalToggle} />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {githubConnected
              ? 'GitHub App is installed and active. Agents with GitHub enabled can browse code, create issues, and propose PRs.'
              : 'GitHub integration is disconnected. Toggle on to allow agents to access the repository.'}
          </p>
        </CardContent>
      </Card>

      {/* Agent Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agent Access</CardTitle>
          <CardDescription>Toggle GitHub access per agent</CardDescription>
        </CardHeader>
        <CardContent className={`space-y-1 ${!githubConnected ? 'opacity-50 pointer-events-none' : ''}`}>
          {!githubConnected && (
            <p className="text-sm text-muted-foreground py-2 text-center">Enable the GitHub integration above to manage agent access.</p>
          )}
          {agents && agents.length > 0 ? agents.map((agent) => {
            const integration = getIntegration(agent.id);
            const enabled = integration?.enabled ?? false;
            const isToggling = toggling === agent.id;

            return (
              <div key={agent.id} className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-accent/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{agent.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{agent.type} · {agent.role}</p>
                </div>
                <div className="flex items-center gap-3">
                  {enabled && githubConnected && (
                    <Badge variant="outline" className="text-xs">
                      <GitBranch className="w-3 h-3 mr-1" /> GitHub
                    </Badge>
                  )}
                  {isToggling ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch checked={enabled} onCheckedChange={() => handleToggle(agent, enabled)} disabled={!githubConnected} />
                  )}
                </div>
              </div>
            );
          }) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No agents found. Add agents first.</p>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audit Log</CardTitle>
          <CardDescription>Recent integration changes</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-accent/20 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{agentNameById(entry.agent_id)}</span>
                      <span className="text-muted-foreground"> — GitHub </span>
                      <Badge variant={entry.action === 'enabled' || entry.action === 'connected' ? 'default' : 'secondary'} className="text-xs">
                        {entry.action}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
