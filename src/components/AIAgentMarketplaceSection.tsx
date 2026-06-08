import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Bot, Star, Clock, Zap, Search, Filter, Cpu, GitBranch, Wallet, Calendar, ShoppingBag, Loader2 } from 'lucide-react';
import { useAIAgents, AIAgent } from '@/hooks/useAIAgents';

const roles = [
  { value: 'all', label: 'All Roles' },
  { value: 'valuation', label: 'Property Valuation' },
  { value: 'legal', label: 'Legal Review' },
  { value: 'research', label: 'Market Research' },
  { value: 'maintenance', label: 'Maintenance Coordination' },
  { value: 'marketing', label: 'Marketing Automation' },
  { value: 'tax', label: 'Tax Planning' },
  { value: 'automation', label: 'Workflow Automation' },
] as const;

type RoleValue = typeof roles[number]['value'];
type SortBy = 'popularity' | 'rating' | 'newest';

const AIAgentMarketplaceSection = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<RoleValue>('all');
  const [sortBy, setSortBy] = React.useState<SortBy>('popularity');
  const [open, setOpen] = React.useState(false);
  const [activeAgent, setActiveAgent] = React.useState<AIAgent | null>(null);

  const { data: agents = [], isLoading } = useAIAgents();

  const filtered = agents.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      a.name.toLowerCase().includes(q) ||
      (a.type || '').toLowerCase().includes(q) ||
      (a.skills || []).some((s) => s.toLowerCase().includes(q));
    const matchesRole = selectedRole === 'all' || a.role === selectedRole;
    return matchesQuery && matchesRole;
  });

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case 'rating':
        return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest':
        return arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      case 'popularity':
      default:
        return arr.sort((a, b) => (b.tasks_completed || 0) - (a.tasks_completed || 0));
    }
  }, [filtered, sortBy]);

  const openAgent = (agent: AIAgent) => {
    setActiveAgent(agent);
    setOpen(true);
  };

  return (
    <section aria-labelledby="ai-agent-marketplace-heading" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="text-center mb-12">
        <h1 id="ai-agent-marketplace-heading" className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-primary bg-clip-text text-transparent">
          AI Agent Marketplace
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-2">
          Hire specialized AI agents trained for real estate, property management, legal, finance, and more.
        </p>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Connect with AI-powered virtual assistants to handle research, scheduling, analysis, and automation-24/7.
        </p>
      </header>

      <Card className="p-6 mb-8 bg-gradient-card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search AI agents by role, skills, or specialization…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search AI agents"
              />
            </div>
          </div>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as RoleValue)}>
            <SelectTrigger>
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">
          Showing {sorted.length} AI agent{sorted.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popularity">Sort by Popularity</SelectItem>
              <SelectItem value="rating">Sort by Rating</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sorted.map((agent) => (
              <Card key={agent.id} className="p-6 hover:shadow-card transition-all duration-300 group">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bot className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-lg truncate">{agent.name} - {agent.type}</h3>
                      <Badge variant="secondary" className="text-xs">AI</Badge>
                    </div>
                    <div className="flex items-center space-x-1 mb-1">
                      <Star className="w-4 h-4 text-warning" />
                      <span className="text-sm font-medium">{(agent.rating || 0).toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({agent.rating_count})</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>Response: {agent.response_time}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    <span>Tasks: {(agent.tasks_completed || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(agent.skills || []).slice(0, 3).map((skill, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{skill}</Badge>
                    ))}
                    {(agent.skills || []).length > 3 && (
                      <Badge variant="outline" className="text-xs">+{agent.skills.length - 3} more</Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-primary">{agent.price_text}</p>
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openAgent(agent)}>
                    View Profile
                  </Button>
                  <Button variant="hero" size="sm" className="flex-1" onClick={() => openAgent(agent)}>
                    Deploy Agent
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {sorted.length === 0 && (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No AI agents found</h3>
              <p className="text-muted-foreground mb-4">Try a different keyword or reset the filters.</p>
              <Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedRole('all'); setSortBy('popularity'); }}>
                Clear Filters
              </Button>
            </Card>
          )}
        </>
      )}

      <Card className="p-8 mt-12 bg-gradient-hero text-primary-foreground text-center">
        <h3 className="text-2xl font-bold mb-4">Are you an AI developer or trainer? List your agent in our marketplace.</h3>
        <Button variant="secondary" size="lg">Apply to Add AI Agent</Button>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {activeAgent && (
            <>
              <DialogHeader>
                <DialogTitle>{activeAgent.name} - {activeAgent.type}</DialogTitle>
                <DialogDescription>
                  Expanded capabilities, commands, and integrations for this AI agent.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Star className="w-4 h-4 text-warning" />
                  <span>{(activeAgent.rating || 0).toFixed(1)} ({activeAgent.rating_count})</span>
                  <Clock className="w-4 h-4 text-muted-foreground ml-4" />
                  <span>Response: {activeAgent.response_time}</span>
                  <Zap className="w-4 h-4 text-muted-foreground ml-4" />
                  <span>Tasks: {(activeAgent.tasks_completed || 0).toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">{activeAgent.description}</p>
                <div>
                  <h4 className="font-semibold mb-2">Integrations</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs flex items-center gap-1"><Wallet className="w-3 h-3" /> Wallet</Badge>
                    <Badge variant="outline" className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Calendar</Badge>
                    <Badge variant="outline" className="text-xs flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> Marketplace</Badge>
                    <Badge variant="outline" className="text-xs flex items-center gap-1"><Cpu className="w-3 h-3" /> Automation</Badge>
                    <Badge variant="outline" className="text-xs flex items-center gap-1"><GitBranch className="w-3 h-3" /> Workflows</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-md border bg-card">
                  <div>
                    <p className="text-sm text-muted-foreground">Pricing</p>
                    <p className="font-medium">{activeAgent.price_text}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline">Contact</Button>
                    <Button variant="hero">Deploy Agent</Button>
                  </div>
                </div>
              </div>
              <DialogFooter />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AIAgentMarketplaceSection;
