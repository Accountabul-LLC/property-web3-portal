

## Problem Analysis

The Portfolio section currently fetches holdings and transactions from the `portfolio_holdings` and `portfolio_transactions` database tables, which are empty. The user wants to see actual XRPL wallet data (token holdings and recent transactions) pulled from the connected wallet's on-chain activity.

## Approach

Since the XRPL has public APIs to query account data, we'll create a new Edge Function that fetches live data from the XRPL for a given wallet address, then display it in the portfolio section. No database seeding needed -- we query the ledger directly.

### Plan

1. **Create `xrpl-account-data` Edge Function** that accepts a wallet address and queries the XRPL public API (`https://xrplcluster.com` or `https://s1.ripple.com:51234`) for:
   - `account_info` -- XRP balance
   - `account_lines` -- trustlines/token holdings  
   - `account_tx` -- recent transactions
   - Returns formatted holdings and transactions

2. **Create `useXRPLPortfolio` hook** that calls the edge function with the connected wallet address and returns:
   - XRP balance
   - Token holdings (trustlines with balances)
   - Recent transactions (parsed from `account_tx`)

3. **Update `PortfolioSection` component** to:
   - Use the new `useXRPLPortfolio` hook instead of (or alongside) the database-backed hooks
   - Display XRP balance as a summary card
   - Show token holdings (trustlines) in the holdings list with currency, issuer, and balance
   - Show recent on-chain transactions with type, amount, date, and tx hash
   - Keep the existing database-backed property token holdings as a separate section

### Technical Details

- **XRPL Public API**: Uses JSON-RPC at `https://xrplcluster.com` (no API key needed)
- **Edge Function**: Proxies XRPL requests to avoid CORS issues from the browser
- **Data mapping**: `account_lines` response maps to token holdings; `account_tx` maps to transaction history
- **No database changes needed** -- this reads directly from the XRPL ledger

