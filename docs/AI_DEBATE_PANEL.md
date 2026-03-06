# AI Debate Panel — Feature Spec

**Route:** `/ai-agents` (new "AI Panel" tab alongside existing Marketplace tab)
**Status:** Spec / Pre-build
**Date:** 2026-03-06

---

## 1. What This Is

A live, multi-turn conversation panel where **Claude** (Anthropic) and **ChatGPT** (OpenAI) discuss a user-submitted topic in the context of this RWA platform — alternating responses, each seeing the other's previous message.

Use cases for users:
- "Should I tokenize this property as MPT or NFT?" → get both AIs to debate it
- "Analyze the risk profile of this investment" → get two independent perspectives
- "Draft a property listing description" → see both AI outputs, pick the best
- General research questions about RWA, XRPL, real estate

---

## 2. Where It Lives

The current `/ai-agents` page has one section: the **AI Agent Marketplace** (hiring specialist agents from a DB table).

This feature adds a **second tab** to that page:

```
/ai-agents
├── Tab 1: Marketplace       ← existing AIAgentMarketplaceSection
└── Tab 2: AI Panel          ← new feature (this spec)
```

The `AIAgents.tsx` page component gets updated to render a `<Tabs>` wrapper. No routing change needed.

---

## 3. Conversation Architecture

### Flow

```
User submits topic/question
        │
        ▼
Supabase Edge Function: ai-debate
        │
        ├─► Anthropic API (Claude)  ──► response_1
        │         system: RWA context + "you are debating with ChatGPT"
        │         messages: [{ role: user, content: topic }]
        │
        ├─► OpenAI API (GPT-4o)     ──► response_2
        │         system: RWA context + "you are debating with Claude"
        │         messages: [{ role: user, content: topic },
        │                    { role: assistant, content: response_1 }]
        │
        ├─► Anthropic API (Claude)  ──► response_3
        │         messages: [..., { role: user, content: response_2 }]
        │
        └─► ... up to N turns (user-configured, default 3 rounds each)
```

Each AI sees the other's last message as a `user` turn in its own message history. This is the simplest reliable approach — no "system pretends to be other AI" hacks.

### Stopping Conditions
- User clicks **Stop**
- Max rounds reached (default: 3 per AI = 6 total messages)
- Either API errors

---

## 4. Edge Function Spec

**Function name:** `ai-debate`
**Method:** POST
**Auth:** Requires valid Supabase session JWT

### Request Body

```typescript
{
  topic: string;              // User's question or prompt
  mode: "debate" | "collaborate" | "compare";
  rounds: number;             // 1–5, default 3
  context: {
    include_portfolio: boolean;   // inject user's holdings
    include_property?: string;    // property ID to inject details
  };
}
```

### Response (streaming NDJSON)

Each line is a JSON event:

```typescript
// New turn starting
{ type: "turn_start", speaker: "claude" | "gpt", turn: number }

// Token chunk (streamed)
{ type: "chunk", speaker: "claude" | "gpt", text: string }

// Turn complete
{ type: "turn_end", speaker: "claude" | "gpt", turn: number, full_text: string }

// All done
{ type: "done", total_turns: number, conversation_id: string }

// Error
{ type: "error", message: string }
```

### Internal Logic (Deno)

```typescript
// Pseudocode
const CLAUDE_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_KEY  = Deno.env.get("OPENAI_API_KEY");

const RWA_CONTEXT = `You are an AI assistant specializing in real-world asset (RWA)
tokenization on the XRP Ledger. The platform uses XRPL MPTs (Multi-Purpose Tokens),
NFTs, and IOU tokens to represent fractional property ownership. Users connect via
Xaman wallets and Supabase Auth.`;

const claudeHistory: Message[] = [];
const gptHistory:    Message[] = [];

// Round-robin: Claude goes first
for (let round = 0; round < rounds; round++) {
  // Claude's turn
  const claudeReply = await streamClaude(claudeHistory, gptHistory.at(-1));
  yield turnEvents("claude", claudeReply);

  // GPT's turn
  const gptReply = await streamGPT(gptHistory, claudeReply);
  yield turnEvents("gpt", gptReply);
}
```

### Secrets Required (Supabase Dashboard → Edge Functions → Secrets)

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `OPENAI_API_KEY` | `sk-...` |

---

## 5. Context Injection (System Prompts)

### Base context (always included)

```
You are an AI assistant for an RWA tokenization platform built on XRPL.
The platform allows users to tokenize real estate as MPT, NFT, or IOU tokens.
Users have Xaman wallets connected. You are currently in a multi-AI panel
discussion with {other_ai_name}. Be direct, substantive, and intellectually honest.
```

### Debate mode additions

```
You are debating {other_ai_name}. Present your strongest reasoning.
Challenge weak arguments. Aim for clarity over agreement.
```

### Collaborate mode additions

```
You are collaborating with {other_ai_name} to give the user the best answer.
Build on what they said, fill in gaps, and synthesize toward a recommendation.
```

### Compare mode additions

```
Give your independent analysis. Do not react to {other_ai_name}'s response —
just give your own assessment so the user can compare perspectives side by side.
```

> **Note:** In Compare mode, the AIs don't see each other's responses. They answer the same question independently. This is implemented by not passing prior AI responses to the next call.

---

## 6. UI Spec

### Layout

```
┌─────────────────────────────────────────────────┐
│  AI Panel                                        │
│  ┌──────────────────────────────────────────┐   │
│  │  Topic / Question                        │   │
│  │  [__________________________________]    │   │
│  │                                          │   │
│  │  Mode: [Debate ▼]  Rounds: [3 ▼]        │   │
│  │  Context: [✓ My Portfolio] [Property ID] │   │
│  │                                     [▶ Start] │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌─── Claude ───────────────────────────────┐   │
│  │  [avatar]  Turn 1                        │   │
│  │  ...streaming text...                    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌─── ChatGPT ──────────────────────────────┐   │
│  │  [avatar]  Turn 1                        │   │
│  │  ...streaming text...                    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  [■ Stop]  [↓ Save Conversation]  [↺ Restart]   │
└─────────────────────────────────────────────────┘
```

### Visual identity per AI

| | Claude | ChatGPT |
|--|--------|---------|
| Color | Amber/orange (Anthropic brand) | Green (OpenAI brand) |
| Avatar | Anthropic logo or stylized "C" | OpenAI logo or stylized "G" |
| Label | "Claude (Sonnet 4.6)" | "ChatGPT (GPT-4o)" |
| Alignment | Left | Right (or alternating) |

### Streaming behavior

- Each message card appears as soon as `turn_start` fires
- Text streams in via `chunk` events using a `useState` string appended per chunk
- Typing indicator (blinking cursor) shows while streaming
- Turn scrolls into view automatically as it appears

### Controls

- **Start** — disabled while a session is running
- **Stop** — visible while running, calls AbortController to cancel the fetch stream
- **Save** — saves the full conversation to Supabase `ai_debate_sessions` table (only if authenticated)
- **Restart** — clears state, re-enables Start with same settings
- **Copy** — per-message copy button on hover

---

## 7. Modes Explained

| Mode | Description | AIs see each other? |
|------|-------------|---------------------|
| **Debate** | Each AI challenges the other's position. Good for weighing tradeoffs. | Yes |
| **Collaborate** | Each AI builds on the other's answer toward a shared recommendation. | Yes |
| **Compare** | Independent answers to the same question. Side-by-side comparison. | No |

---

## 8. Database Changes

### New table: `ai_debate_sessions`

```sql
create table ai_debate_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  topic       text not null,
  mode        text not null check (mode in ('debate', 'collaborate', 'compare')),
  rounds      int  not null default 3,
  transcript  jsonb not null default '[]',  -- array of { speaker, text, turn }
  context     jsonb,
  created_at  timestamptz default now()
);

alter table ai_debate_sessions enable row level security;

create policy "Users see own sessions"
  on ai_debate_sessions for all
  using (auth.uid() = user_id);
```

### `transcript` shape

```json
[
  { "speaker": "claude", "turn": 1, "text": "..." },
  { "speaker": "gpt",    "turn": 1, "text": "..." },
  { "speaker": "claude", "turn": 2, "text": "..." }
]
```

---

## 9. New Files to Create

```
supabase/functions/ai-debate/
└── index.ts                    ← edge function orchestrator (includes role check)

src/
├── pages/
│   └── AIAgents.tsx            ← update: add Tabs wrapper
├── components/ai-panel/
│   ├── AIPanel.tsx             ← main panel component
│   ├── AIPanelGate.tsx         ← locked state shown to non-team users
│   ├── DebateControls.tsx      ← topic input, mode/rounds selectors, start/stop
│   ├── DebateTurn.tsx          ← single AI message card with streaming
│   └── DebateHistory.tsx       ← saved sessions list
└── hooks/
    ├── useTeamAccess.ts        ← queries user_roles, returns { hasAccess, loading }
    └── useDebateSession.ts     ← manages stream, state, abort, save
```

---

## 10. Access Control — Team Only

The AI Panel is **not a public feature**. It is restricted to your internal team.
The existing infrastructure already supports this — no new membership system needed.

### What Already Exists

| Asset | Location | Purpose |
|-------|----------|---------|
| `user_roles` table | Supabase DB | Maps `user_id → app_role` |
| `app_role` enum | `"admin" \| "moderator" \| "user"` | Role values |
| `has_role(_role, _user_id)` | Postgres function | Server-side role check |

### Decision: Which role = "team"?

Two options:

**Option A — Use `admin` role (recommended for now)**
No DB changes needed. You and your team members get assigned `admin` in `user_roles`.
Simple, immediate, zero migration.
Downside: "admin" conflates platform admin with AI Panel access.

**Option B — Add a `team` role to the enum**
Add `'team'` to the `app_role` enum via migration. Cleaner semantics long term.
Requires a Supabase migration + redeploying functions.

**Recommended: Option A now, migrate to Option B when you do the V2 rebuild.**

---

### How It Works — Two Layers

#### Layer 1: Client-side guard (UX)

A new `useTeamAccess` hook:

```typescript
// src/hooks/useTeamAccess.ts
export function useTeamAccess() {
  const { user, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setHasAccess(false); setLoading(false); return; }

    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin'])          // swap to ['admin','team'] after Option B
      .maybeSingle()
      .then(({ data }) => {
        setHasAccess(!!data);
        setLoading(false);
      });
  }, [user]);

  return { hasAccess, loading };
}
```

The AI Panel tab renders a **locked gate** for non-team users instead of the panel:

```
┌─────────────────────────────────────────┐
│  🔒  Team Access Only                   │
│                                         │
│  The AI Panel is available to           │
│  internal team members only.            │
│                                         │
│  If you believe you should have         │
│  access, contact the admin.             │
└─────────────────────────────────────────┘
```

- The tab itself is visible (not hidden) — no security by obscurity
- The gate renders regardless of auth state (logged-in non-team users also see it)
- No panel controls, no API calls, no cost exposure

#### Layer 2: Edge function guard (enforcement)

The `ai-debate` edge function checks the role **server-side** before processing anything.
This is the real security layer — the client guard is just UX.

```typescript
// Inside ai-debate/index.ts
const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
if (!jwt) return new Response("Unauthorized", { status: 401 });

const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
if (!user) return new Response("Unauthorized", { status: 401 });

const { data: roleRow } = await supabaseAdmin
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .in("role", ["admin"])
  .maybeSingle();

if (!roleRow) return new Response("Forbidden", { status: 403 });

// Only reaches here if user has admin role
```

---

### How to Add a Team Member

Run this in the Supabase SQL editor (or Dashboard → Table Editor → `user_roles`):

```sql
-- Find the user's ID first
select id, email from auth.users where email = 'teammate@example.com';

-- Grant team access
insert into user_roles (user_id, role)
values ('<their-uuid>', 'admin');
```

To revoke access: delete the row from `user_roles`.

---

### What Public Users See on `/ai-agents`

| User type | Marketplace tab | AI Panel tab |
|-----------|----------------|--------------|
| Unauthenticated | Visible | Locked gate |
| Logged in, no role | Visible | Locked gate |
| Logged in, `user` role | Visible | Locked gate |
| Logged in, `admin` role | Visible | Full access |

The marketplace tab remains public as before. Nothing changes for regular users.

---

## 11. Models Used

| AI | Model | Notes |
|----|-------|-------|
| Claude | `claude-sonnet-4-6` | Default. Could offer `claude-opus-4-6` toggle for power users |
| ChatGPT | `gpt-4o` | Latest stable. `gpt-4o-mini` could be a cost-saving option |

---

## 12. Estimated Scope

| Layer | Work |
|-------|------|
| Edge function | ~150 lines Deno, new file (includes role check) |
| DB migration | 1 table (`ai_debate_sessions`), 1 policy — `user_roles` already exists |
| React components | ~5 new components (includes `AIPanelGate`) |
| Hooks | 2 new hooks (`useTeamAccess`, `useDebateSession`) |
| Page update | AIAgents.tsx: add Tabs, ~20 lines |
| Team member setup | Manual SQL inserts, no code required |
| **Total** | Medium feature, ~1-2 days focused build |

---

## 13. Open Questions / Decisions Needed

1. **Role to use for "team"**: Option A (`admin`) now vs Option B (add `team` enum) — see §10.
2. **Who pays for the API calls?** Keys are in Supabase secrets → you pay. Since this is team-only with a small user set, rate limiting is less urgent, but could add a daily cap as a safeguard.
3. **Compare mode layout**: True side-by-side (two columns) or sequential? Side-by-side is better UX but needs responsive handling.
4. **Rename the tab**: "AI Panel" vs "AI Debate" vs "AI Roundtable"?
5. **Keep the existing Marketplace tab?** It currently shows no data (empty `ai_agents` table). Could drop it or keep it as a placeholder for a future sprint.

---

## 14. Next Steps

1. **Decide §13 items**, especially which role to use (Option A vs B)
2. **Grant team access**: Insert rows into `user_roles` for your team members (SQL in §10)
3. **Apply DB migration**: Create `ai_debate_sessions` table
4. **Add secrets** to Supabase: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
5. **Build** `useTeamAccess` hook
6. **Build** edge function `supabase/functions/ai-debate/index.ts`
7. **Build** `useDebateSession` hook + UI components
8. **Update** `AIAgents.tsx` with Tabs + gate logic
9. **Test** locally with `supabase functions serve`
