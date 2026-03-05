

## Fix Asset Scale Input — Leading Zero Issue

The Asset Scale input (`type="number"`) displays leading zeros (e.g., "015" instead of "15") and prevents erasing them due to how the browser handles number inputs combined with the current `onChange` logic.

### Fix

**`src/components/mint/MPTForm.tsx`** — Change the Asset Scale input to `type="text"` with `inputMode="numeric"`, and parse/sanitize the value to strip leading zeros:

- Change `type="number"` to `type="text"` with `inputMode="numeric"`
- Remove `min`/`max` props (handle in onChange instead)
- In `onChange`: strip non-numeric chars, parse to integer, clamp 0–15, store result
- Display the value as a plain string (no leading zeros since we parse to integer)

