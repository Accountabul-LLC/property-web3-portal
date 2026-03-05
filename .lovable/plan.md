

## Ensure Fully Responsive Layout Across All Devices and Browsers

The app already has the correct `<meta name="viewport" content="width=device-width, initial-scale=1.0">` tag and `overflow-x: hidden` on `#root`. Most page layouts use responsive Tailwind classes. However, there are specific areas that can cause horizontal overflow or poor formatting on smaller screens.

### Changes

**1. Global overflow guard on `<html>` and `<body>` (`src/index.css`)**

Add `overflow-x: hidden` to both `html` and `body` in the base layer to prevent any child element from causing horizontal scroll, regardless of browser:

```css
@layer base {
  * { @apply border-border; }
  html, body { overflow-x: hidden; }
  body { @apply bg-background text-foreground; }
}
```

**2. Clamp hero background blurs (`src/components/HeroSection.tsx`)**

The `w-96` (384px) decorative blur circles at lines 46-47 can extend beyond the viewport on small screens. Wrap them or add `max-w-full` / use `w-[60vw]` capped with responsive classes so they never cause overflow.

**3. Audit fixed-width elements across pages**

Scan and fix any elements using absolute pixel widths (`w-[500px]`, fixed `min-w-` values, etc.) that don't have responsive counterparts. Key areas to check:
- `PortfolioSection.tsx` — token cards, expanded detail panels
- `Dashboard.tsx` — profile form layout, wallet cards  
- `PropertyDetail.tsx` — photo gallery, financial sidebar
- `Tokenize.tsx` / `Mint.tsx` — form containers

For each, ensure containers use `max-w-full`, `w-full`, or responsive breakpoint classes instead of fixed pixel widths.

**4. Add `break-words` / `truncate` to long text fields**

Wallet addresses, transaction hashes, and URIs can push containers wider than the viewport on mobile. Add `break-all` or `truncate` classes where these are displayed (portfolio cards, dashboard wallet section).

This is a defensive, global approach — not hardcoded to any specific device — that makes the browser's own viewport data drive the layout through standard responsive CSS.

