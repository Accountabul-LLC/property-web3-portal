

## Show Token Image in MPT Card Icon

The selected element at line 667 is the circular icon container on each MPT issuance card. Currently it always shows a generic `Gem` icon. Since MPTs now carry an `image` field in their decoded metadata, the card should display the token's uploaded image when available, falling back to the Gem icon when not.

### Change

**File: `src/components/PortfolioSection.tsx` (lines 667-669)**

Replace the static Gem icon div with a conditional that renders:
- An `<img>` tag (rounded, 40x40, object-cover) when `mpt.image` exists
- The existing Gem icon fallback when no image is available

```tsx
<div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-primary/10">
  {mpt.image ? (
    <img src={mpt.image} alt={mpt.name || 'MPT'} className="w-full h-full object-cover" />
  ) : (
    <Gem className="w-5 h-5 text-primary" />
  )}
</div>
```

This mirrors how other token holdings on the page display their icons from the XRPL Meta API. Single file, 3-line change.

