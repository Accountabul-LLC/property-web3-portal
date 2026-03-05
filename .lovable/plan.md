

## Plan: Fix Refresh Button for Multi-Wallet Portfolio

### Problem
When multiple wallets are connected, the refresh button only works for the first wallet. Switching to a second wallet and clicking refresh does not fetch new data. Network requests confirm only the first wallet address is being queried.

### Root Cause
The `refetch()` function from `useXRPLPortfolio` is correctly keyed per wallet address, so it should work. However, the refresh button only refetches the XRPL account data query -- it does not also invalidate the token metadata query (`useTokenMeta`). Additionally, when switching wallets on the same route, React Query's `staleTime: 15_000` may serve cached data and the manual `refetch()` call may not be propagating correctly if the component doesn't fully re-render on wallet switch.

### Fix

**1. Update refresh handler in `PortfolioSection.tsx`**
Instead of calling `refetch()` on just the portfolio query, use `queryClient.invalidateQueries` to invalidate ALL queries related to the current wallet address. This ensures both `xrpl_portfolio` and `xrpl_token_meta` queries are refetched:

```tsx
const queryClient = useQueryClient();

const handleRefresh = () => {
  queryClient.invalidateQueries({ queryKey: ['xrpl_portfolio', displayAddress] });
  queryClient.invalidateQueries({ queryKey: ['xrpl_token_meta'] });
};
```

Replace the refresh button's `onClick={() => refetch()}` with `onClick={handleRefresh}`.

**2. Ensure `refetchOnMount: 'always'` is working**
The `useXRPLPortfolio` hook already has `refetchOnMount: 'always'`, but when switching wallets on the same `/portfolio` route, the component doesn't remount -- it re-renders. The query key change (`['xrpl_portfolio', newAddress]`) should trigger a new fetch, but we should verify by also setting `staleTime` behavior to not block initial fetches for new keys.

### Files to modify
- `src/components/PortfolioSection.tsx` -- add `useQueryClient` import, replace `refetch()` with `invalidateQueries` for both portfolio and token meta queries

