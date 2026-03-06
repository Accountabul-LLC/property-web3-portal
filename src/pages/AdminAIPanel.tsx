import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeamAccess } from '@/hooks/useTeamAccess';
import Navigation from '@/components/Navigation';
import SessionSidebar, { type SavedSession } from '@/components/ai-panel/SessionSidebar';
import AIPanel from '@/components/ai-panel/AIPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Loader2, Bot, Code2, Settings2, PanelRightOpen, PanelRightClose } from 'lucide-react';

const CodeBrowser = lazy(() => import('@/components/admin/CodeBrowser'));
const IntegrationsDashboard = lazy(() => import('@/components/admin/IntegrationsDashboard'));

const AdminAIPanel = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useTeamAccess();
  const [selectedSession, setSelectedSession] = useState<SavedSession | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [codePanelOpen, setCodePanelOpen] = useState(false);

  useEffect(() => {
    if (authLoading || accessLoading) return;
    if (!user) { navigate('/auth?tab=admin'); return; }
    if (!hasAccess) { navigate('/dashboard'); return; }
  }, [user, authLoading, hasAccess, accessLoading, navigate]);

  const handleNew = useCallback(() => setSelectedSession(null), []);
  const handleSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

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
      <Tabs defaultValue="ai-panel" className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4 flex items-center justify-between">
          <TabsList className="bg-transparent h-12">
            <TabsTrigger value="ai-panel" className="gap-2 data-[state=active]:bg-primary/10">
              <Bot className="w-4 h-4" /> AI Panel
            </TabsTrigger>
            <TabsTrigger value="code-browser" className="gap-2 data-[state=active]:bg-primary/10">
              <Code2 className="w-4 h-4" /> Code Browser
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2 data-[state=active]:bg-primary/10">
              <Settings2 className="w-4 h-4" /> Integrations
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ai-panel" className="flex-1 flex overflow-hidden mt-0">
          <div className="w-72 flex-shrink-0 hidden md:block">
            <SessionSidebar
              activeSessionId={selectedSession?.id ?? null}
              onSelect={setSelectedSession}
              onNew={handleNew}
              refreshKey={refreshKey}
            />
          </div>

          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={codePanelOpen ? 55 : 100} minSize={40}>
              <div className="h-full overflow-y-auto relative">
                {/* Toggle Code Browser button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCodePanelOpen(!codePanelOpen)}
                  className="absolute top-2 right-2 z-10 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {codePanelOpen ? (
                    <><PanelRightClose className="w-4 h-4" /> Hide Code</>
                  ) : (
                    <><PanelRightOpen className="w-4 h-4" /> Show Code</>
                  )}
                </Button>
                <AIPanel loadedSession={selectedSession} onSaved={handleSaved} />
              </div>
            </ResizablePanel>

            {codePanelOpen && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={45} minSize={25}>
                  <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
                    <CodeBrowser embedded />
                  </Suspense>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </TabsContent>

        <TabsContent value="code-browser" className="flex-1 overflow-hidden mt-0 p-4">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
            <CodeBrowser />
          </Suspense>
        </TabsContent>

        <TabsContent value="integrations" className="flex-1 overflow-y-auto mt-0">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
            <IntegrationsDashboard />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAIPanel;
