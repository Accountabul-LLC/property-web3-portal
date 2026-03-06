import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DebateSpeaker = 'gemini' | 'gpt';
export type DebateMode = 'debate' | 'collaborate' | 'compare';

export interface AgentMeta {
  id: DebateSpeaker;
  label: string;
  model: string;
}

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
  const [agents, setAgents] = useState<{ a: AgentMeta; b: AgentMeta } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function start(params: DebateParams) {
    setTurns([]);
    setSessionId(null);
    setError(null);
    setAgents(null);
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
      case 'agents':
        setAgents({
          a: event.agent_a as AgentMeta,
          b: event.agent_b as AgentMeta,
        });
        break;

      case 'turn_start':
        setTurns(prev => [
          ...prev,
          { speaker: event.speaker as DebateSpeaker, turn: event.turn as number, text: '', streaming: true },
        ]);
        break;

      case 'chunk':
        setTurns(prev => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].speaker === event.speaker) {
              next[i] = { ...next[i], text: next[i].text + (event.text as string) };
              break;
            }
          }
          return next;
        });
        break;

      case 'turn_end':
        setTurns(prev => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].speaker === event.speaker) {
              next[i] = { ...next[i], streaming: false, text: event.full_text as string };
              break;
            }
          }
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

    await (supabase.from('ai_debate_sessions') as any).insert({
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
    setAgents(null);
  }

  return { turns, running, sessionId, error, agents, start, stop, saveSession, reset };
}
