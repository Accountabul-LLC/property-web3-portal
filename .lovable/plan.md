

## Problem

The "Create Issue" feature pushes GitHub issues with minimal content. The issue body only contains the parsed action item title and a one-line description. It lacks the full debate context — the transcript of what the agents actually discussed, the reasoning behind the recommendation, and any relevant code references.

## Root Causes

1. **Sparse issue body template** (line 104): The `createIssue` function builds the body from just `action.title`, `action.description`, and `action.priority` — no debate transcript or agent reasoning is included.

2. **Weak parsing** (lines 202-226): `parseActions` uses a simple regex that captures only one line per action item. Multi-line reasoning, code snippets, and context from the AI's conclusion output are discarded.

## Plan

### 1. Enrich the GitHub issue body with debate context

Update `createIssue` in `ActionableConclusions.tsx` to build a richer issue body that includes:

- **Summary section**: The action item title and full description
- **Debate context section**: A condensed version of the debate transcript (the `turns` prop is already available)
- **Participants**: Which agents spoke and their perspectives
- **Topic**: The original debate topic
- **Priority rationale**: Why this priority was assigned

The new body template would look like:

```markdown
## Action Item: {title}

{description}

### Debate Context

**Topic:** {topic}
**Participants:** {unique speakers from turns}

#### Key Discussion Points
{condensed transcript — last N relevant turns, trimmed to ~2000 chars}

---
*Priority: {priority}*
*Generated from AI Panel debate*
```

### 2. Improve the `parseActions` function

Update the parser to handle multi-line action items so that descriptions capture full paragraphs of reasoning rather than just the first line after the colon. This means accumulating lines after a numbered item until the next numbered item is found.

### 3. Truncate intelligently

Cap the transcript included in the issue body at ~3000 characters to stay within reasonable GitHub issue size, prioritizing the most recent and relevant turns.

### Files to modify
- `src/components/ai-panel/ActionableConclusions.tsx` — enrich `createIssue` body template and improve `parseActions`

