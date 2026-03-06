import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import AIAgentMarketplaceSection from '@/components/AIAgentMarketplaceSection';
import AIPanel from '@/components/ai-panel/AIPanel';
import AIPanelGate from '@/components/ai-panel/AIPanelGate';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useTeamAccess } from '@/hooks/useTeamAccess';

const AIAgents = () => {
  const { hasAccess, loading } = useTeamAccess();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="marketplace">
          <TabsList className="mb-8">
            <TabsTrigger value="marketplace">Agent Marketplace</TabsTrigger>
            <TabsTrigger value="ai-panel">AI Panel</TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace">
            <AIAgentMarketplaceSection />
          </TabsContent>

          <TabsContent value="ai-panel">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : hasAccess ? (
              <AIPanel />
            ) : (
              <AIPanelGate />
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default AIAgents;
