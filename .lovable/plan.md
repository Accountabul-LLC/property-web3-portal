

## Plan: Chat-First AI Panel with Task Management

### What Changes

**1. Flip the layout — chat-style conversation at top, controls at bottom**

Currently the topic/mode/rounds form (`DebateControls`) sits at the top and conversation flows below. We'll invert this to match ChatGPT's UX:
- Conversation history scrolls in the main area (top)
- A fixed input bar sits at the bottom with the topic textarea, mode selector, and send button
- First message starts a new session; subsequent messages continue the conversation

**2. Persistent chat input bar**

Replace the separate `DebateControls` form and the mid-round "your turn" textarea with a single unified input bar pinned to the bottom. It handles:
- Starting a new debate (first message)
- Injecting user messages between rounds
- Mode/rounds as compact dropdowns inline with the input

**3. Action-oriented collaborate mode — GitHub Issues & Tasks**

When in `collaborate` mode, after each round the agents will be instructed to output structured action items. The `ActionableConclusions` component will be enhanced to:
- Parse agent outputs for task recommendations
- Add a "Create GitHub Issue" button per action item that calls the existing `github-agent` edge function (`create_issue` action)
- Show status indicators (created/pending) for each task

### Files to Change

| File | Change |
|------|--------|
| `src/components/ai-panel/AIPanel.tsx` | Restructure layout: scrollable conversation area on top, fixed bottom input bar. Merge `DebateControls` inline. Remove separate "your turn" block — unify into bottom bar. |
| `src/components/ai-panel/DebateControls.tsx` | Refactor into a compact bottom bar component (`ChatInputBar`) with inline mode/rounds selectors and a text input + send button. |
| `src/components/ai-panel/DebateTurn.tsx` | Minor: remove round badge clutter for cleaner chat bubbles. |
| `src/components/ai-panel/ActionableConclusions.tsx` | Add "Create Issue" button per action item that calls `github-agent` `create_issue`. Show created issue links. |
| `supabase/functions/ai-debate/index.ts` | In `collaborate` mode, append instructions to system prompt telling agents to output structured tasks/issues with clear titles and descriptions. |
| `src/hooks/useDebateSession.ts` | No major changes — the existing `start`/`continueRound` flow already supports the chat pattern. Minor: expose a helper to check if a session is active so the input bar knows whether to start or continue. |

### Layout Structure

```text
┌─────────────────────────────────────────┐
│  Session Sidebar  │  Conversation Area  │
│                   │  ┌───────────────┐  │
│  [Past sessions]  │  │ Agent turns   │  │
│                   │  │ User messages │  │
│                   │  │ (scrollable)  │  │
│                   │  │               │  │
│                   │  └───────────────┘  │
│                   │  ┌───────────────┐  │
│                   │  │ [Mode▾][Rds▾] │  │
│                   │  │ [Type message…│  │
│                   │  │          Send]│  │
│                   │  └───────────────┘  │
└─────────────────────────────────────────┘
```

### GitHub Issue Creation Flow

When "Create Issue" is clicked on an action item:
1. Frontend calls `github-agent` edge function with `action: "create_issue"`
2. Uses existing GitHub App auth (already configured)
3. Returns issue URL, displayed inline as a link
4. Owner/repo hardcoded to `JibreelMuhammad/property-web3-portal` (matching existing usage)

