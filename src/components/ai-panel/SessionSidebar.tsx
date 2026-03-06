import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { MessageSquare, Clock, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

export interface SavedSession {
  id: string;
  topic: string;
  mode: string;
  rounds: number;
  transcript: Json;
  created_at: string;
}

interface Props {
  activeSessionId: string | null;
  onSelect: (session: SavedSession) => void;
  onNew: () => void;
  refreshKey: number;
}

const SessionSidebar = ({ activeSessionId, onSelect, onNew, refreshKey }: Props) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from('ai_debate_sessions')
      .select('id, topic, mode, rounds, transcript, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setSessions((data as SavedSession[]) ?? []);
        setLoading(false);
      });
  }, [user, refreshKey]);

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      <div className="p-4 border-b">
        <Button onClick={onNew} className="w-full gap-2" size="sm">
          <MessageSquare className="w-4 h-4" />
          New Session
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            No saved sessions yet. Start a debate and save it.
          </p>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className={cn(
                  'w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent/50',
                  activeSessionId === s.id && 'bg-accent text-accent-foreground'
                )}
              >
                <p className="font-medium truncate leading-tight">{s.topic}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  <span className="capitalize">· {s.mode}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default SessionSidebar;
