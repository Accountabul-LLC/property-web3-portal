

## Code Audit: XRPL Connection Resilience and Security Vulnerabilities

### Findings Summary

After reviewing all edge functions and client-side code, here are the critical issues organized by severity.

---

### CRITICAL: Single Point of Failure (No Failover)

**4 edge functions use a single hardcoded XRPL node with zero failover:**

| Function | Node | Network | Failover |
|---|---|---|---|
| `xrpl-build-payment` | `xrplcluster.com` | Mainnet only | None |
| `xrpl-build-token-payment` | `xrplcluster.com` | Mainnet only | None |
| `xrpl-build-mint` | Single node per network | Both | None |
| `xrpl-submit-signed` | `s.altnet.rippletest.net` | Testnet only | None |

**1 client-side hook uses a single hardcoded WebSocket:**
- `useXRPLSubscription.ts` — hardcoded to `wss://xrplcluster.com` with no failover to other WS endpoints

**Only `xrpl-account-data` has proper multi-node failover** with retry logic and rate-limit handling. This is the pattern all functions should follow.

---

### CRITICAL: Network Mismatch Bugs

- **`xrpl-build-payment`**: Hardcoded to mainnet `xrplcluster.com`. Does not accept or use a `network` parameter. If called with a testnet wallet, it queries mainnet and will fail or return wrong data.
- **`xrpl-build-token-payment`**: Same issue — hardcoded to mainnet, no network parameter.
- **`xrpl-build-mint`**: Uses `getXRPLNode(network)` but returns only a single node per network, no failover pool.

---

### HIGH: Reserve Calculation Inconsistency

Different functions use different XRPL reserve values:

| Function | Base Reserve | Owner Reserve |
|---|---|---|
| `xrpl-account-data` | 1 XRP | 0.2 XRP |
| `xrpl-build-payment` | 10 XRP | 2 XRP |

The `xrpl-account-data` values (1 / 0.2) reflect the current XRPL amendment. `xrpl-build-payment` uses the old pre-amendment values (10 / 2), which means it shows 10x more XRP as "reserved" and blocks legitimate sends.

---

### HIGH: WebSocket Network Awareness

`useXRPLSubscription` always connects to mainnet (`wss://xrplcluster.com`) regardless of the active wallet's network. Testnet wallets get subscribed to mainnet and never receive transaction updates.

---

### Plan

**1. Create shared XRPL node pool utility for edge functions**

Extract the multi-node failover pattern from `xrpl-account-data` into a reusable approach applied to all 4 affected functions:
- Mainnet pool: `s2.ripple.com`, `s1.ripple.com`, `xrplcluster.com`
- Testnet pool: `s.altnet.rippletest.net`, `testnet.xrpl-labs.com`
- Include retry logic with backoff and 429/503 handling

**2. Add `network` parameter to `xrpl-build-payment` and `xrpl-build-token-payment`**

Both functions currently ignore network. Add a `network` field to the request body and select the correct node pool. This also fixes the reserve calculation by querying `server_state` for live reserve values instead of hardcoding.

**3. Fix `xrpl-build-mint` to use node pool**

Replace `getXRPLNode()` single-node lookup with the same failover pool pattern.

**4. Fix `xrpl-submit-signed` to use testnet node pool**

Replace the single `TESTNET_RPC` constant with the testnet node pool and failover.

**5. Fix `useXRPLSubscription` for network-aware WebSocket with failover**

- Accept `network` parameter alongside `walletAddress`
- Use correct WS endpoints per network:
  - Mainnet: `wss://xrplcluster.com`, `wss://s1.ripple.com`, `wss://s2.ripple.com`
  - Testnet: `wss://s.altnet.rippletest.net:51233`
- On connection failure, cycle to next WS endpoint before applying backoff

**6. Normalize reserve calculations**

Fix `xrpl-build-payment` to use the correct post-amendment reserves (1 XRP base, 0.2 XRP per owner object), matching `xrpl-account-data`.

### Files to modify
- `supabase/functions/xrpl-build-payment/index.ts` — add network param, node pool, fix reserves
- `supabase/functions/xrpl-build-token-payment/index.ts` — add network param, node pool
- `supabase/functions/xrpl-build-mint/index.ts` — replace single node with pool
- `supabase/functions/xrpl-submit-signed/index.ts` — add testnet node pool
- `src/hooks/useXRPLSubscription.ts` — network-aware WS with endpoint failover

