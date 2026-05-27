## Problem

In `src/components/Navigation.tsx`, the mobile menu (`isMobileMenuOpen`) is closed manually inside each button's `onClick` after calling `navigate(...)`. This works for most items but is fragile — anything that changes the route through other means (logo click, wallet-connect flows, programmatic redirects, browser back/forward) leaves the menu visible, which matches what you're seeing: tap a link, page changes, menu sticks.

## Fix

Add a single `useEffect` in `Navigation.tsx` that watches `location.pathname` and unconditionally closes the mobile menu whenever the route changes. Then remove the now-redundant `setIsMobileMenuOpen(false)` calls scattered across the mobile menu's button handlers (keep the handlers themselves — just drop the close call) to keep the code clean and consistent.

```tsx
React.useEffect(() => {
  setIsMobileMenuOpen(false);
}, [location.pathname]);
```

## Files

- `src/components/Navigation.tsx` — add the effect; tidy up redundant close calls in the mobile menu buttons (lines ~271, 296, 305, 331, 349).

## Verification

- Open menu on mobile width, tap each link type (nav item, Dashboard, KYC, Admin, Sign In/Out, logo) → menu closes every time.
- Backdrop click and Escape key still close (unchanged).
- Desktop layout unaffected.