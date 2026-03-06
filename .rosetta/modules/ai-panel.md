# Module: AI Panel (Team-Only)

## What It Is

A live multi-turn conversation panel at `/ai-agents` (AI Panel tab) where Claude (claude-sonnet-4-6) and ChatGPT (gpt-4o) discuss a user-submitted topic in the context of this RWA platform. Team access only — gated by `admin` role.

## Access Control

**Two layers:**
1. Client: `useTeamAccess()` hook queries `user_roles` — renders `AIPanelGate` (lock screen) for non-admin users
2. Server: `ai-debate` edge function checks `user_roles` before touching either API

Grant access: `insert into user_roles (user_id, role) values ('<uuid>', 'admin')`

## Modes

| Mode | AIs see each other? | Use for |
|------|---------------------|---------|
| `debate` | Yes | Tradeoffs, decisions |
| `collaborate` | Yes | Building toward a recommendation |
| `compare` | No (independent) | Side-by-side perspectives |

## Streaming Protocol (NDJSON)

Edge function streams newline-delimited JSON events:
```
{ type: "turn_start", speaker: "claude"|"gpt", turn: number }
{ type: "chunk", speaker, text: string }          ← token-by-token
{ type: "turn_end", speaker, turn, full_text }
{ type: "done", total_turns, conversation_id }
{ type: "error", message }
```

## Conversation Flow

```
For each round (1 to N):
  1. Claude call (streaming) → stream chunks to client, collect full text
  2. Feed Claude's reply to GPT as user message (except compare mode)
  3. GPT call (streaming) → stream chunks to client, collect full text
  4. Feed GPT's reply to Claude as user message (except compare mode)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/AIAgents.tsx` | Page with Tabs: Marketplace + AI Panel |
| `src/components/ai-panel/AIPanel.tsx` | Main panel orchestrator |
| `src/components/ai-panel/AIPanelGate.tsx` | Lock screen for non-team |
| `src/components/ai-panel/DebateControls.tsx` | Topic/mode/rounds form |
| `src/components/ai-panel/DebateTurn.tsx` | Single AI turn card (streaming cursor) |
| `src/hooks/useTeamAccess.ts` | Admin role check |
| `src/hooks/useDebateSession.ts` | Stream consumer, turn state, abort, save |
| `supabase/functions/ai-debate/index.ts` | Edge function orchestrator |

## Secrets Required in Supabase

- `ANTHROPIC_API_KEY` — for Claude calls
- `OPENAI_API_KEY` — for GPT calls

## DB Table

`ai_debate_sessions` — saves completed conversations:
```
id, user_id, topic, mode, rounds, transcript (jsonb array), context, created_at
```
RLS: users see only own sessions.

## Spec

Full feature spec at `docs/AI_DEBATE_PANEL.md`
