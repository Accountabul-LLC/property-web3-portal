

## Plan: Real-Time XRPL Account Subscription for Instant Balance Updates

### Problem
After sending a payment, the portfolio takes up to 30 seconds (the polling interval) to reflect the updated balance. The user wants immediate feedback when a transaction is confirmed on the XRPL ledger.

### Approach
Subscribe to the XRPL ledger's native WebSocket `subscribe` command for the active account. When the ledger reports a transaction affecting the account, immediately invalidate the React Query cache to trigger a refetch. This gives near-instant balance updates without relying on polling alone.

### Technical Details

**1. Create a new hook: `src/hooks/useXRPLSubscription.ts`**
- Opens a WebSocket connection to `wss://xrplcluster.com` (the WebSocket counterpart of the existing RPC node).
- Sends an XRPL `subscribe` command for the active wallet's account using `accounts_proposed` or `accounts` stream.
- On receiving a `transaction` event for the account, calls `queryClient.invalidateQueries({ queryKey: ['xrpl_portfolio', walletAddress] })` to trigger an immediate refetch.
- Handles reconnection with exponential backoff if the WebSocket closes unexpectedly.
- Cleans up (unsubscribe + close) when the wallet address changes or the component unmounts.
- Subscribes only when a wallet address is provided.

**2. Integrate in `src/components/PortfolioSection.tsx`**
- Call the new `useXRPLSubscription(displayAddress)` hook alongside the existing `useXRPLPortfolio` hook.
- No UI changes needed; the existing React Query data flow will automatically re-render with fresh data once the cache is invalidated.

**3. Trigger immediate refresh after SendModal success**
- In `SendModal.tsx`, when a transaction succeeds (step transitions to `'success'`), also invalidate the portfolio query immediately so the balance updates even before the WebSocket event arrives.

**4. Reduce polling interval (optional cleanup)**
- With the WebSocket subscription handling real-time updates, the 30-second polling in `useXRPLPortfolio` can be increased to 60 seconds as a safety fallback, reducing unnecessary network requests.

### File Changes Summary
| File | Change |
|------|--------|
| `src/hooks/useXRPLSubscription.ts` | New hook — XRPL WebSocket subscription with auto-reconnect |
| `src/components/PortfolioSection.tsx` | Add `useXRPLSubscription(displayAddress)` call |
| `src/components/SendModal.tsx` | Invalidate portfolio query on successful send |
| `src/hooks/useXRPLPortfolio.ts` | Increase polling fallback from 30s to 60s |

