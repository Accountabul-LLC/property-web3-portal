import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ServerNotification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  campaign_id: string | null;
  donation_id: string | null;
  tx_hash: string | null;
  amount: number | null;
  currency: string | null;
  network: string | null;
  read_at: string | null;
  created_at: string;
}

let audioEl: HTMLAudioElement | null = null;
function playPing() {
  try {
    if (typeof window === 'undefined') return;
    if (document.hidden) return;
    if (localStorage.getItem('accountabul_notifications_muted') === '1') return;
    if (!audioEl) {
      audioEl = new Audio('/notification.mp3');
      audioEl.volume = 0.5;
    }
    audioEl.currentTime = 0;
    void audioEl.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function useServerNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const seenIds = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ['user-notifications', userId],
    queryFn: async () => {
      if (!userId) return [] as ServerNotification[];
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (data ?? []) as ServerNotification[];
      list.forEach(n => seenIds.current.add(n.id));
      return list;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as ServerNotification;
          if (seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);
          queryClient.invalidateQueries({ queryKey: ['user-notifications', userId] });
          playPing();
          toast(n.title, { description: n.body ?? undefined });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return {
    notifications: query.data ?? [],
    unreadCount: (query.data ?? []).filter(n => !n.read_at).length,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export async function markServerNotificationRead(id: string) {
  await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
}

export async function markAllServerNotificationsRead(userId: string) {
  await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
}
