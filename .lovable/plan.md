## Treasury Tracker

A public, no-login transparency page that mirrors the REI treasury wallet live from the XRPL.

**Tracked wallet (hardcoded):**
- `rPZdYatVHP4YegTp3qQzkdojCAihb8DmAx` — "REI Wallet" (testnet)

Easy to extend later by adding more entries to a single config array.

### Page layout (`/treasury`)

```text
┌──────────────────────────────────────────────────────┐
│  Accountabul Treasury                                │
│  Live, on-chain transparency for our reserves.       │
├──────────────────────────────────────────────────────┤
│  ┌──── Total Treasury Value ────┐  Network: Testnet  │
│  │  $XX,XXX.XX                  │  Updated 12s ago   │
│  │  REI Wallet · rPZd…8DmAx ↗   │                    │
│  └──────────────────────────────┘                    │
├──────────────────────────────────────────────────────┤
│  Token Holdings                                      │
│  [logo] XRP        1,234.5  ≈ $XXX                   │
│  [logo] RLUSD        500.0  ≈ $500                   │
│  ...                                                 │
├──────────────────────────────────────────────────────┤
│  Property / RWA Holdings (MPT)                       │
│  [img] Coral Reef Property   25 units                │
│  ...                                                 │
├──────────────────────────────────────────────────────┤
│  Recent Activity                                     │
│  ↗ Sent 100 XRP · 2h ago · view on explorer ↗        │
│  ↙ Received Coral Reef MPT · 1d ago · ...            │
└──────────────────────────────────────────────────────┘
```

Sections, top to bottom:
1. **Header** — title, one-line transparency blurb, network badge, "last updated" timestamp.
2. **Total value card** — big USD number, wallet label + truncated address with copy + Bithomp explorer link.
3. **Token holdings list** — XRP, IOUs (RLUSD, etc.) with logos, balance, USD value. Sorted by USD descending.
4. **MPT / property holdings grid** — cards with image, name, units held, issuer link.
5. **Recent activity** — last ~15 transactions with direction, amount, age, explorer link.

Auto-refresh every 30s. Public — no auth required.

### Navigation
- Add "Treasury" link to top nav (`Navigation.tsx`), visible to all visitors.

### Technical details

**New files:**
- `src/pages/Treasury.tsx` — public page, wraps `Navigation` + treasury content + `Footer`.
- `src/components/treasury/TreasuryTracker.tsx` — main view; reads the tracked-wallets config and renders one section per wallet (forward-compatible with multiple).
- `src/components/treasury/TreasuryHoldingsList.tsx` — token + MPT lists with logos via existing `useTokenMeta` hook.
- `src/components/treasury/TreasuryActivity.tsx` — recent tx list.
- `src/config/treasuryWallets.ts` — `[{ address, label, network }]` array, hardcoded with the REI wallet. Single source of truth for adding/removing tracked wallets.

**Reused (no changes needed):**
- `useXRPLPortfolio(address, network)` — already returns balances, MPT issuances/holdings, and transactions. Works for any address; ownership isn't enforced at the data layer.
- `xrpl-account-data` edge function — already public (no auth required).
- `useTokenMeta` — token logos / names from XRPL Meta.
- USD valuation logic from `PortfolioSection` (XRPL Meta + CoinGecko) — extracted into a small shared hook `useTokenUsdValues` if not already shared, otherwise mirrored.

**Routing:**
- Add `<Route path="/treasury" element={<Treasury />} />` in `App.tsx`.

**No backend changes.** No new tables, no migrations, no edge function changes — the tracker is read-only and uses the existing public XRPL data path.

### Out of scope (call out for later)
- Historical treasury value chart over time (would need a daily snapshot job).
- Admin-managed wallet list (currently hardcoded as requested).
- Mainnet wallet (REI is testnet today; flipping later is a one-line config change).
