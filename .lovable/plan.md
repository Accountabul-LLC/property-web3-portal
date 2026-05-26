## Goal
Make each wallet row in the "All Wallets" section expandable to show its assets inline, while keeping the existing click-to-switch behavior available.

## Changes (single file: `src/components/UnifiedWalletsOverview.tsx`)

1. **Split the row interaction**
   - Make the whole row toggle expand/collapse (the primary, most discoverable action).
   - Move "switch to this wallet" to a dedicated control: clicking the chevron arrow (and/or a small "View" affordance) calls `setActiveWallet` + navigates to `/portfolio?account=...`.
   - The chevron icon rotates 90° when the row is expanded to signal state.

2. **Track expanded state**
   - Add `const [expanded, setExpanded] = useState<Set<string>>(new Set())` keyed by wallet address. Multiple rows can be open at once.

3. **Render an inline asset dropdown beneath each expanded row**
   - Data is already fetched per wallet via `portfolioQueries[idx]` and `metaQueries[idx]` — no new network calls.
   - For the expanded wallet, render a contained panel (indented, subtle bg like `bg-muted/20`, rounded) listing:
     - XRP balance (with USD if `xrpUsd` available)
     - Each IOU token from `token_holdings` — show currency code (decoded if hex via existing meta), issuer short, balance, and USD value when `meta.price` exists
     - Each MPT from `mpt_issuances` and `mpt_holdings` — show identifier and amount
   - Empty state: "No assets" if the wallet has zero holdings.
   - Loading state: small skeleton lines while `portfolioQueries[idx].isLoading`.

4. **Keep it contained**
   - Expanded content stays inside the `All Wallets` Card.
   - Cap height with `max-h-72 overflow-y-auto` so a wallet with many tokens doesn't blow out the card.
   - Use existing semantic tokens (`bg-muted`, `text-muted-foreground`, `border-border`) — no custom colors.

## Out of scope
- No backend, hook, or data-fetching changes.
- No changes to PortfolioSection or routing.
- Switch-wallet logic is unchanged; only its trigger moves from the whole row to the arrow control.
