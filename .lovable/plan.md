## Code Audit: XRPL Connection Resilience — COMPLETED

### Changes Applied

1. **Node pool failover** added to all 4 edge functions (`xrpl-build-payment`, `xrpl-build-token-payment`, `xrpl-build-mint`, `xrpl-submit-signed`) — matching the pattern from `xrpl-account-data` with multi-node retry, 429/503 handling, and backoff.

2. **Network parameter** added to `xrpl-build-payment` and `xrpl-build-token-payment` — they now accept `network` in the request body and select the correct node pool (mainnet or testnet).

3. **Reserve calculation fixed** in `xrpl-build-payment` — updated from old values (10 XRP / 2 XRP) to current post-amendment values (1 XRP / 0.2 XRP).

4. **WebSocket failover** in `useXRPLSubscription` — now accepts `network` parameter, uses correct WS endpoints per network, and cycles through endpoints on connection failure.

5. **SendModal** updated to pass `network` to both payment edge functions.

### Node Pools
- **Mainnet**: `s2.ripple.com`, `s1.ripple.com`, `xrplcluster.com`
- **Testnet**: `s.altnet.rippletest.net`, `testnet.xrpl-labs.com`
- **Mainnet WS**: `xrplcluster.com`, `s1.ripple.com`, `s2.ripple.com`
- **Testnet WS**: `s.altnet.rippletest.net:51233`
