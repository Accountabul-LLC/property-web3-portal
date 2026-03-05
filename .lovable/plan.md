

## Testnet-Aware Portfolio Section with Faucet Top-Up

### Problem
The "Account Worth" card and portfolio view look identical for testnet and mainnet wallets. Users can't tell at a glance which network they're on, and there's no way to top up XRP on testnet wallets without generating a brand new one.

### Changes

#### 1. **PortfolioSection.tsx** — Testnet visual distinction + faucet button

- Import `activeWallet` from context and check `activeWallet?.provider === 'testnet_faucet'`
- When testnet wallet is active:
  - Add a `Badge` with `FlaskConical` icon reading "Testnet" next to "Account Worth" heading
  - Change the card's border/gradient to use an amber/yellow accent (e.g. `border-amber-500/30 bg-amber-500/5`)
  - Add a "Fund with Faucet" button next to the Refresh button that calls the existing `xrpl-testnet-faucet` edge function to fund the *current* wallet address (not create a new one)
  - Update the XRPL Explorer link to point to `testnet.xrpl.org` instead of `livenet.xrpl.org`
- When mainnet wallet: no changes, current behavior

#### 2. **xrpl-testnet-faucet edge function** — Support funding existing address

- Currently the faucet always creates a new account. Add an optional `destination` param in the request body.
- If `destination` is provided, call the XRPL testnet faucet with `{ destination }` so the faucet funds that existing address instead of generating a new one.
- If no destination, keep current behavior (create new account + return secret).

#### 3. **xrpl-account-data edge function** — Testnet-aware endpoint selection

- Currently this function likely hits mainnet. Need to check if it accepts a `network` param and routes to the correct XRPL node (`s.altnet.rippletest.net` for testnet vs `s1.ripple.com` for mainnet).
- The portfolio hook will need to pass the network context so the correct ledger is queried.

#### 4. **useXRPLPortfolio hook** — Pass network context

- Accept `network` param (derived from active wallet provider)
- Pass it to the edge function so it queries the correct XRPL node

### Files to modify
- `src/components/PortfolioSection.tsx` — Testnet badge, amber styling, faucet button, correct explorer URLs
- `supabase/functions/xrpl-testnet-faucet/index.ts` — Accept optional `destination` to fund existing accounts
- `supabase/functions/xrpl-account-data/index.ts` — Route to testnet/mainnet node based on `network` param
- `src/hooks/useXRPLPortfolio.ts` — Pass network to edge function

