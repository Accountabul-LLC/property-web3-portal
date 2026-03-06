import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
const THROTTLE_MS = 60_000; // Only update timer once per minute

/**
 * Global inactivity timeout hook.
 * After 30 minutes of no user interaction, signs out of Supabase Auth
 * and calls the provided onTimeout callback (to clear wallet context, etc.)
 */
export function useInactivityTimeout(onTimeout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastActivityRef = useRef(Date.now());

  const resetTimer = useCallback(() => {
    const now = Date.now();
    // Throttle: only reset if enough time has passed since last reset
    if (now - lastActivityRef.current < THROTTLE_MS) return;
    lastActivityRef.current = now;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      console.log('Inactivity timeout reached (30 min). Signing out.');
      await supabase.auth.signOut();
      onTimeout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [onTimeout]);

  useEffect(() => {
    // Set initial timer
    timerRef.current = setTimeout(async () => {
      console.log('Inactivity timeout reached (30 min). Signing out.');
      await supabase.auth.signOut();
      onTimeout();
    }, INACTIVITY_TIMEOUT_MS);

    // Listen for user activity
    const handler = () => resetTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handler, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handler);
      }
    };
  }, [resetTimer, onTimeout]);
}
