import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeamAccess } from '@/hooks/useTeamAccess';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import AIPanel from '@/components/ai-panel/AIPanel';
import SessionSidebar, { type SavedSession } from '@/components/ai-panel/SessionSidebar';
import { Loader2 } from 'lucide-react';

const AdminAIPanel = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useTeamAccess();
  const [selectedSession, setSelectedSession] = useState<SavedSession | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (authLoading || accessLoading) return;
    if (!user) { navigate('/auth?tab=admin'); return; }
    if (!hasAccess) { navigate('/dashboard'); return; }
  }, [user, authLoading, hasAccess, accessLoading, navigate]);

  const handleNew = useCallback(() => {
    setSelectedSession(null);
  }, []);

  const handleSaved = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

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
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 hidden md:block">
          <SessionSidebar
            activeSessionId={selectedSession?.id ?? null}
            onSelect={setSelectedSession}
            onNew={handleNew}
            refreshKey={refreshKey}
          />
        </div>

        {/* Main panel */}
        <div className="flex-1 overflow-y-auto">
          <AIPanel
            loadedSession={selectedSession}
            onSaved={handleSaved}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminAIPanel;
