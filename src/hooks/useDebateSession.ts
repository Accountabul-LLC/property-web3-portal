import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DebateSpeaker = 'claude' | 'gpt';
export type DebateMode = 'debate' | 'collaborate' | 'compare';

export interface DebateTurnData {
  speaker: DebateSpeaker;
  turn: number;
  text: string;
  streaming: boolean;
}

export interface DebateParams {
  topic: string;
  mode: DebateMode;
  rounds: number;
}

export function useDebateSession() {
  const [turns, setTurns] = useState<DebateTurnData[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function start(params: DebateParams) {
    setTurns([]);
    setSessionId(null);
    setError(null);
    setRunning(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Not authenticated');
      setRunning(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-debate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        const text = await res.text();
        setError(text || `Error ${res.status}`);
        setRunning(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            handleEvent(event);
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setRunning(false);
    }
  }

  function handleEvent(event: Record<string, unknown>) {
    switch (event.type) {
      case 'turn_start':
        setTurns(prev => [
          ...prev,
          { speaker: event.speaker as DebateSpeaker, turn: event.turn as number, text: '', streaming: true },
        ]);
        break;

      case 'chunk':
        setTurns(prev => {
          const next = [...prev];
          const last = next.findLast(t => t.speaker === event.speaker);
          if (last) last.text += event.text as string;
          return next;
        });
        break;

      case 'turn_end':
        setTurns(prev => {
          const next = [...prev];
          const last = next.findLast(t => t.speaker === event.speaker);
          if (last) { last.streaming = false; last.text = event.full_text as string; }
          return next;
        });
        break;

      case 'done':
        setSessionId(event.conversation_id as string);
        break;

      case 'error':
        setError(event.message as string);
        break;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  async function saveSession(params: DebateParams) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const transcript = turns.map(t => ({
      speaker: t.speaker,
      turn: t.turn,
      text: t.text,
    }));

    await supabase.from('ai_debate_sessions' as never).insert({
      user_id: user.id,
      topic: params.topic,
      mode: params.mode,
      rounds: params.rounds,
      transcript,
    });
  }

  function reset() {
    stop();
    setTurns([]);
    setSessionId(null);
    setError(null);
  }

  return { turns, running, sessionId, error, start, stop, saveSession, reset };
}
