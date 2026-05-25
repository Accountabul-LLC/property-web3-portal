## Goal
Display a small thumbnail image on the left side of each cause card in the Admin Causes list, when that cause has an image loaded.

## What’s changing
In `src/pages/AdminCauses.tsx`, inside the card header row (the clickable top section of each campaign card), add a small image thumbnail before the title/content area.

- Only renders when `campaign.image_url` is present (no placeholder for causes without an image).
- Size: approximately 1" × 1.5" — implemented as responsive `w-16 h-24 sm:w-20 sm:h-28` (64×96px up to 80×112px).
- Styled with `object-cover`, rounded corners, and a subtle border to match the card design system.

## Why this size
Tailwind utility classes map to:
- Mobile: `w-16 h-24` = 64×96 px
- Desktop (`sm:`): `w-20 h-28` = 80×112 px

This keeps the thumbnail visible without overpowering the card layout, and sits cleanly alongside the existing badge/title/description block.

## Scope
- One file: `src/pages/AdminCauses.tsx`
- No backend, schema, or edge function changes.
- No changes to existing card actions (Edit, Approve, Reject, Release).