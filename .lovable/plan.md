

## Plan: Structured Task Extraction via `conclude` Mode

### Problem
The `ai-debate` edge function has no `conclude` mode. When "Generate Action Items" fires, it falls through the normal 3-agent debate flow, producing prose instead of structured tasks. The frontend parser then struggles to extract multiple discrete items.

### Approach
Use **tool calling** (structured output) via the Lovable AI gateway instead of parsing freeform text. This gives us a stable JSON payload every time.

### Changes

#### 1. Edge function: Add `conclude` early-return branch (`supabase/functions/ai-debate/index.ts`)

Before the 3-agent streaming logic, add a branch:

```
if (mode === 'conclude') → single Lovable AI call with tool_choice
```

- Uses `google/gemini-3-flash-preview` via `https://ai.gateway.lovable.dev/v1/chat/completions`
- Sends the full `transcript_summary` (from request body) as user content
- Uses **tool calling** with a `extract_action_items` function definition that enforces this schema:
  - `action_items[]`: array of `{ title, priority (HIGH|MEDIUM|LOW), description, files[], expected_outcome }`
- Returns a single NDJSON event: `{ type: "conclude_result", action_items: [...] }` then closes the stream
- No debate flow, no 3-agent rotation

#### 2. Frontend: Update `ActionableConclusions.tsx`

- Update `generate()` to detect the new `conclude_result` event type and read `action_items` directly from the JSON payload (no text parsing needed)
- Map `priority` from uppercase (`HIGH`/`MEDIUM`/`LOW`) to lowercase for the UI
- Include `files` and `expected_outcome` in the rendered card and in the GitHub issue body
- Keep `parseActions()` as a fallback if the response doesn't contain structured data
- Increase item cap from 5 to 8

#### 3. Update `RequestBody` type in edge function

- Add `'conclude'` to the `Mode` union
- Add `transcript_summary?: string` field

### Files to modify
- `supabase/functions/ai-debate/index.ts` — add conclude branch with tool-calling
- `src/components/ai-panel/ActionableConclusions.tsx` — consume structured JSON, enhance cards with files/outcome

