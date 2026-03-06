## Plan: Add Gemini (Lovable AI) as a Third Agent in AI Panel

### What Changes

Add a third AI speaker — "Gemini" — powered by the Lovable AI Gateway (`google/gemini-3-flash-preview`), which speaks after GPT in each round. The existing Claude and GPT flows remain untouched. this bot will speak first.

### Edge Function (`supabase/functions/ai-debate/index.ts`)

1. **Update types**: Add `'gemini'` to the `Speaker` type
2. **Add `buildGeminiHistory**`: Similar to `buildGPTHistory` — maps own replies as `assistant`, others as `user` (skip others in compare mode)
3. **Add `buildSystem` support**: Handle `speaker === 'gemini'` with identity "Gemini (gemini-3-flash-preview)"
4. **Add `streamGemini` function**: Calls `https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY`, model `google/gemini-3-flash-preview`, streaming enabled. Parses OpenAI-compatible SSE format (same as GPT parser). Emits `turn_start`/`chunk`/`turn_end` events with `speaker: 'gemini'`, turn 3.
5. **Update round flow**: After `streamGPT`, call `streamGemini(claudeReply, gptReply)` — Gemini sees both prior replies (unless compare mode)
6. **Update `done` event**: `total_turns: 3`

### Frontend Hook (`src/hooks/useDebateSession.ts`)

1. Add `'gemini'` to `DebateSpeaker` type
2. In `runRound`, capture `roundReplies.gemini` from `turn_end` events and push to history
3. Update `turnOffset` calculation: `(round - 1) * 3` (3 turns per round instead of 2)

### UI (`src/components/ai-panel/DebateTurn.tsx`)

Add Gemini to `AI_SPEAKER_CONFIG`:

```
gemini: {
  label: 'Gemini',
  subtitle: 'gemini-3-flash-preview',
  bg: 'bg-blue-50 dark:bg-blue-950/30',
  border: 'border-blue-200 dark:border-blue-800',
  badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  avatar: 'bg-blue-500 text-white',
  initial: 'G✦',
}
```

### What stays the same

- Claude and GPT API calls, keys, and streaming logic are unchanged
- Auth, role checks, GitHub context injection all unchanged
- No new secrets needed (`LOVABLE_API_KEY` is already configured)
- add to all agent conversation types and modes in ai panel.