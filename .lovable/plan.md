

## Plan: Add "Task Dashboard" Button to ActionItemsTab

**What**: Add a button labeled "Task Dashboard" next to the "Action Items" heading that navigates to `/action-items`.

**Where**: `src/components/ai-panel/ActionItemsTab.tsx`, line 189

**How**:
- Import `useNavigate` from `react-router-dom`
- Add a `useNavigate` hook call in the component
- Insert a "Task Dashboard" button next to the `<h2>` heading, using `navigate('/action-items')` on click
- Style as a small outlined button with an icon (e.g., `ExternalLink` or `LayoutDashboard`) to indicate navigation

```tsx
// After the <h2> tag on line 189:
<Button
  variant="outline"
  size="sm"
  onClick={() => navigate('/action-items')}
  className="text-xs gap-1.5"
>
  <LayoutDashboard className="w-3.5 h-3.5" />
  Task Dashboard
</Button>
```

The heading area will become a flex row with the title on the left and the new button beside it, before the filter buttons on the right.

