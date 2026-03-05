

## Investigation: Account Worth Card Not Refreshing for Multi-Wallet

The previous fix has already been applied — `handleRefresh` now calls `queryClient.invalidateQueries` for both `xrpl_portfolio` and `token_meta` queries keyed to `displayAddress`. The code at lines 59-61 looks correct.

### Potential remaining issue

The `$0.00` value likely means the **token metadata query** (`useTokenMeta`) isn't returning price data for the second wallet's tokens. When you switch wallets:

1. `displayAddress` changes → `useXRPLPortfolio` fires a new query (correct)
2. `useTokenMeta` receives new token holdings → fires a new query (correct)
3. `portfolioValuation` recomputes using `xrpUsdPrice` from token meta

If `xrpUsdPrice` is `0` (token meta hasn't resolved yet), the total shows `$0.00`.

### What the refresh fix already does

- Invalidates `['xrpl_portfolio', displayAddress]` — forces refetch of wallet balances for the current wallet
- Invalidates `['token_meta']` — forces refetch of all token price data

### Recommended next step

Since the code fix is already in place, this should be **tested end-to-end** by:
1. Connecting two wallets
2. Switching to the second wallet
3. Clicking Refresh on the Account Worth card
4. Verifying the balance updates from `$0.00` to the real value

If it still shows `$0.00` after clicking Refresh, the issue is likely in the **edge function** (`xrpl-token-meta`) not returning `xrp_usd` for certain requests, which would need backend debugging.

No additional code changes are needed — the fix from the previous message should resolve the refresh issue. Would you like me to test this in the browser?

