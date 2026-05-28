## Goal
Flip the visual direction of the billing toggle (Monthly/Annual) in `src/pages/Pricing.tsx` so the knob position is reversed while preserving the same `annual` state behavior.

## Current Behavior
- `annual = false` (Monthly): knob on the **left**, button bg muted
- `annual = true` (Annual): knob on the **right**, button bg primary

## Desired Behavior
- `annual = false` (Monthly): knob on the **right**
- `annual = true` (Annual): knob on the **left**

## Change
In the `<button>` and `<span>` inside it (lines ~79–87):
1. Swap the knob translate classes: use `annual ? 'translate-x-0.5' : 'translate-x-5'`
2. Swap the button background classes: use `annual ? 'bg-muted-foreground/30' : 'bg-primary'`

No other logic changes. `onClick`, label highlighting, and downstream pricing cards remain untouched.
