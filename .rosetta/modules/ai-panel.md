# Module: AI Panel (Team-Only)

## What It Is

A live multi-turn conversation panel at `/ai-agents` (AI Panel tab) where two AI agents discuss a user-submitted topic in the context of this RWA platform. Team access only — gated by `admin` role.

## AI Gateway

All AI calls go through **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`) using the auto-provisioned `LOVABLE_API_KEY`. **No external API keys required** (no Anthropic/OpenAI keys).

Default agents:
- **Agent A**: `google/gemini-3-flash-preview` (Gemini Pro)
- **Agent B**: `openai/gpt-5-mini` (GPT-5 Mini)

The edge function sends an `agents` metadata event at stream start so the frontend dynamically renders agent labels/models.

## Access Control

**Two layers:**
1. Client: `useTeamAccess()` hook queries `user_roles` — renders `AIPanelGate` (lock screen) for non-admin users
2. Server: `ai-debate` edge function checks `user_roles` before touching the gateway

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
{ type: "agents", agent_a: { id, label, model }, agent_b: { id, label, model } }
{ type: "turn_start", speaker: "gemini"|"gpt", turn: number }
{ type: "chunk", speaker, text: string }          ← token-by-token
{ type: "turn_end", speaker, turn, full_text }
{ type: "done", total_turns, conversation_id }
{ type: "error", message }
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
| `supabase/functions/ai-debate/index.ts` | Edge function — Lovable AI Gateway orchestrator |

## Secrets Required

- `LOVABLE_API_KEY` — auto-provisioned, used for Lovable AI Gateway calls

## DB Table

`ai_debate_sessions` — saves completed conversations:
```
id, user_id, topic, mode, rounds, transcript (jsonb array), context, created_at
```
RLS: users see only own sessions.

## Spec

Full feature spec at `docs/AI_DEBATE_PANEL.md`
