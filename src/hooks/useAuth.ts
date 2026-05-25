import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

// Module-level singleton: load session once, share across all useAuth() mounts
// so navigations don't re-trigger a loading flash.
let cachedUser: User | null = null;
let cachedLoading = true;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function init() {
  if (initialized) return;
  initialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    cachedUser = session?.user ?? null;
    cachedLoading = false;
    notify();
  });

  supabase.auth.getSession().then(({ data: { session } }) => {
    cachedUser = session?.user ?? null;
    cachedLoading = false;
    notify();
  });
}

export function useAuth() {
  init();
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(cachedLoading);

  useEffect(() => {
    const sync = () => {
      setUser(cachedUser);
      setLoading(cachedLoading);
    };
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signOut };
}
