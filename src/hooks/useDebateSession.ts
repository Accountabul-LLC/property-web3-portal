import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DebateSpeaker = 'claude' | 'gpt' | 'gemini' | 'user';
export type DebateMode = 'debate' | 'collaborate' | 'compare';

export interface DebateTurnData {
  speaker: DebateSpeaker;
  turn: number;
  text: string;
  streaming: boolean;
}

export interface HistoryItem {
  speaker: 'claude' | 'gpt' | 'gemini' | 'user';
  text: string;
}

export interface DebateParams {
  topic: string;
  mode: DebateMode;
  rounds: number;
  selectedFiles?: string[];
}

export function useDebateSession() {
  const [turns, setTurns] = useState<DebateTurnData[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [awaitingUserInput, setAwaitingUserInput] = useState(false);

  const historyRef = useRef<HistoryItem[]>([]);
  const paramsRef = useRef<DebateParams | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function runRound(params: DebateParams, history: HistoryItem[], round: number) {
    setRunning(true);
    setAwaitingUserInput(false);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Not authenticated');
      setRunning(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const turnOffset = (round - 1) * 3;
    const roundReplies: { claude?: string; gpt?: string; gemini?: string } = {};

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-debate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ topic: params.topic, mode: params.mode, history, round, turnOffset, selectedFiles: params.selectedFiles || [] }),
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

            // Capture full texts to build history
            if (event.type === 'turn_end') {
              if (event.speaker === 'claude') roundReplies.claude = event.full_text as string;
              if (event.speaker === 'gpt') roundReplies.gpt = event.full_text as string;
              if (event.speaker === 'gemini') roundReplies.gemini = event.full_text as string;
            }

            if (event.type === 'done') {
              if (roundReplies.claude) {
                historyRef.current = [...historyRef.current, { speaker: 'claude', text: roundReplies.claude }];
              }
              if (roundReplies.gpt) {
                historyRef.current = [...historyRef.current, { speaker: 'gpt', text: roundReplies.gpt }];
              }
              if (roundReplies.gemini) {
                historyRef.current = [...historyRef.current, { speaker: 'gemini', text: roundReplies.gemini }];
              }
              setSessionId(event.conversation_id as string);
              if (round < params.rounds) {
                setAwaitingUserInput(true);
              }
            }

            handleEvent(event, turnOffset);
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

  function handleEvent(event: Record<string, unknown>, turnOffset: number) {
    const absoluteTurn = (event.turn as number) + turnOffset;

    switch (event.type) {
      case 'turn_start':
        setTurns(prev => [
          ...prev,
          { speaker: event.speaker as DebateSpeaker, turn: absoluteTurn, text: '', streaming: true },
        ]);
        break;

      case 'chunk':
        setTurns(prev => {
          const next = [...prev];
          const last = next.findLast(t => t.speaker === event.speaker && t.streaming);
          if (last) last.text += event.text as string;
          return next;
        });
        break;

      case 'turn_end':
        setTurns(prev => {
          const next = [...prev];
          const last = next.findLast(t => t.speaker === event.speaker && t.streaming);
          if (last) { last.streaming = false; last.text = event.full_text as string; }
          return next;
        });
        break;

      case 'error':
        setError(event.message as string);
        break;
    }
  }

  async function start(params: DebateParams) {
    setTurns([]);
    setSessionId(null);
    setError(null);
    setCurrentRound(1);
    setAwaitingUserInput(false);
    historyRef.current = [];
    paramsRef.current = params;
    await runRound(params, [], 1);
  }

  async function continueRound(userMessage?: string) {
    const params = paramsRef.current;
    if (!params) return;

    const nextRound = currentRound + 1;
    setCurrentRound(nextRound);

    if (userMessage?.trim()) {
      const msg = userMessage.trim();
      historyRef.current = [...historyRef.current, { speaker: 'user', text: msg }];
      setTurns(prev => [
        ...prev,
        { speaker: 'user', turn: nextRound, text: msg, streaming: false },
      ]);
    }

    await runRound(params, historyRef.current, nextRound);
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
    setAwaitingUserInput(false);
  }

  async function saveSession(params: DebateParams) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const transcript = turns.map(t => ({
      speaker: t.speaker,
      turn: t.turn,
      text: t.text,
    }));

    await supabase.from('ai_debate_sessions').insert({
      user_id: user.id,
      topic: params.topic,
      mode: params.mode,
      rounds: params.rounds,
      transcript: transcript as unknown as import('@/integrations/supabase/types').Json,
    });
  }

  function loadTranscript(transcript: Array<{ speaker: string; turn: number; text: string }>) {
    stop();
    setTurns(transcript.map(t => ({ ...t, speaker: t.speaker as DebateSpeaker, streaming: false })));
    setSessionId(null);
    setError(null);
    setCurrentRound(0);
    setAwaitingUserInput(false);
    historyRef.current = [];
    paramsRef.current = null;
  }

  function reset() {
    stop();
    setTurns([]);
    setSessionId(null);
    setError(null);
    setCurrentRound(0);
    setAwaitingUserInput(false);
    historyRef.current = [];
    paramsRef.current = null;
  }

  return {
    turns,
    running,
    sessionId,
    error,
    currentRound,
    awaitingUserInput,
    start,
    continueRound,
    stop,
    saveSession,
    reset,
    loadTranscript,
  };
}
