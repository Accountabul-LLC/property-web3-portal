## Goal
Replace the current full-width drawer (which spans `left-0 right-0` under the header) with a narrower left-side panel — similar to Lovable's sidebar — so the rest of the page stays visible behind/beside it.

## Changes (src/components/Navigation.tsx only)

1. **Panel sizing & position** (lines ~276-279)
   - Change container from `fixed left-0 right-0 top-[72px]` to `fixed left-0 top-[72px] bottom-0`.
   - Width: `w-72` on mobile (≈288px so phones stay usable), scaling to `sm:w-80 md:w-96` on larger viewports, with `max-w-[85vw]` cap. This lands around 25% on a desktop-sized viewport while staying readable on small screens.
   - Add a right border + subtle shadow (`border-r border-border shadow-lg`) for the slid-in-from-side feel.

2. **Backdrop**
   - Keep the click-to-close overlay but soften it (`bg-background/40 backdrop-blur-sm`) so the rest of the page is clearly visible behind it instead of fully covered.

3. **Slide-in animation**
   - Add `animate-in slide-in-from-left duration-200` to the panel and `animate-in fade-in duration-200` to the overlay so it visually slides in from the side like a sidebar.

4. **Internal scroll area**
   - Keep `max-h-[calc(100vh-72px)] overflow-y-auto` so long nav lists still scroll inside the panel.

## Out of scope
- No changes to the header itself, nav items, or button placement (Dashboard button and Connect-wallet removal stay as-is).
- Not switching to the shadcn `Sidebar` component — that would be a larger refactor; this matches the requested behavior with the existing drawer code.

## Result
At desktop widths the menu opens as a ~288–384px panel pinned to the left under the header, with ~75%+ of the page still visible to the right behind a light translucent overlay. Clicking outside or pressing Escape closes it (existing behavior preserved).
