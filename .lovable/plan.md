

# Fix: Network Toggle Should Not Disconnect Wallet

## Problem

The current `setActiveNetwork` in `ActiveWalletContext` tries to find a different wallet tagged with the selected network. If no wallet is stored with that network tag, it sets `activeAddress` to `null` — effectively ending the session. The user's intent is different: **switching network is a viewing context change, not a wallet change**. The same XRPL address exists on both mainnet and testnet.

## Root Cause

Two places enforce the wrong behavior:

1. **`setActiveNetwork`** (context) — line 141-152: auto-switches active wallet to one matching the new network, or nulls it out
2. **`PortfolioSection`** — line 60-62: derives `network` from `activeWallet.network` instead of `activeNetwork` from context

## Plan

| File | Change |
|------|--------|
| `src/contexts/ActiveWalletContext.tsx` | Simplify `setActiveNetwork` to only update the network state + localStorage. Remove the wallet-switching/nulling logic. The active wallet stays connected regardless of toggle. |
| `src/components/PortfolioSection.tsx` | Pull `activeNetwork` from context instead of deriving from `activeWallet?.network`. Use `activeNetwork` for explorer links, data fetching, and faucet visibility. |

### `setActiveNetwork` — new behavior
```typescript
const setActiveNetwork = useCallback((network: XRPLNetwork) => {
  setActiveNetworkState(network);
  localStorage.setItem(NETWORK_KEY, network);
  // No wallet switching — same wallet, different network view
}, []);
```

### `PortfolioSection` — use context network
```typescript
const { activeAddress, activeWallet, isConnected, activeNetwork } = useActiveWallet();
// ...
const network = activeNetwork;  // was: activeWallet?.network === 'testnet' ? 'testnet' : 'mainnet'
const explorerBase = activeNetwork === 'testnet' ? 'https://testnet.xrpl.org' : 'https://livenet.xrpl.org';
```

This means:
- Wallet session stays persistent through network toggles
- Portfolio data re-fetches for the same address on the selected network
- Faucet button appears when `activeNetwork === 'testnet'`
- No disconnection, no re-auth required

