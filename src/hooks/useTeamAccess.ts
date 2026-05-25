import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Module-level cache: admin role lookup is shared across all consumers so
// page navigations don't re-trigger a loading flash.
const roleCache = new Map<string, boolean>();
const pending = new Map<string, Promise<boolean>>();

async function fetchRole(userId: string): Promise<boolean> {
  if (roleCache.has(userId)) return roleCache.get(userId)!;
  if (pending.has(userId)) return pending.get(userId)!;

  const p = (async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    const has = !!data;
    roleCache.set(userId, has);
    pending.delete(userId);
    return has;
  })();

export function useTeamAccess() {
  const { user, loading: authLoading } = useAuth();
  const cached = user ? roleCache.get(user.id) : undefined;
  const [hasAccess, setHasAccess] = useState(cached ?? false);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    const known = roleCache.get(user.id);
    if (known !== undefined) {
      setHasAccess(known);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchRole(user.id).then((has) => {
      setHasAccess(has);
      setLoading(false);
    });
  }, [user, authLoading]);

  return { hasAccess, loading };
}
