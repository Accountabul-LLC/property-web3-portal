# Wallet Activity Notifications

Notify users when their active wallet receives funds (XRP, RLUSD, MPTs, IOUs), when an escrow they're party to is finished/cancelled, and other meaningful on-chain events — without polling REST endpoints.

## How it works

We already have `useXRPLSubscription` which opens a WebSocket to XRPL and listens to `transaction` messages for the active wallet. Today it only invalidates React Query caches. We extend it to also classify each validated transaction and emit a user-facing notification.

```text
XRPL WS  →  useXRPLSubscription  →  classifyTx(tx, activeAddress)
                                       │
                                       ├─ invalidate portfolio/balances (existing)
                                       └─ notificationStore.add({...})
                                              │
                                              ├─ Sonner toast (live, ephemeral)
                                              └─ Bell dropdown in Navigation (persistent, unread badge)
```

## Scope of notifications (v1)

Trigger only when `tx.validated === true` AND the active wallet is the **counterparty receiving value or affected**:

- **XRP received** — `Payment` where `Destination === activeAddress`, delivered_amount is XRP
- **Token received** — `Payment` where `Destination === activeAddress`, delivered_amount is IOU/MPT (decode currency, show issuer-friendly name via existing `useTokenMeta` when possible)
- **Escrow released to you** — `EscrowFinish` where `Destination === activeAddress` (covers the donation-release case the user described)
- **Escrow cancelled (refund)** — `EscrowCancel` returning funds to `Account === activeAddress`
- **Escrow created against you** — `EscrowCreate` where `Destination === activeAddress` (incoming pending escrow)
- **Trustline set by someone to your issued token** — optional, off by default in v1
- **Outgoing payment confirmed** — quiet success toast only (no bell entry), so the user gets feedback after Xaman signs

Each notification stores: `id, kind, title, body, amount, currency, counterparty, tx_hash, network, created_at, read`.

## UI

1. **Toast** — Sonner toast on arrival, click → opens explorer link for the tx (network-aware: Bithomp mainnet / testnet).
2. **Bell icon** in `Navigation.tsx`, right of the network/wallet area:
   - Badge with unread count
   - Popover lists last 50 notifications, grouped by day
   - "Mark all as read" + per-row click jumps to explorer
3. **Empty state** — "You'll see wallet activity here as it happens."

## Persistence

Two options — pick one:

- **A. Local only (recommended for v1):** keep notifications in `localStorage` keyed by `wallet_address + network`. Zero backend work, survives reloads, naturally scoped per wallet. Cap at 200 entries.
- **B. DB-backed:** new `wallet_notifications` table with RLS via `owns_wallet`. Adds cross-device sync but requires migration + an edge function to backfill missed events when the user was offline.

Default plan = **A**. We can layer B later if users ask for cross-device sync or offline backfill.

## Missed-while-offline handling (v1)

On wallet connect / app load, fetch the last ~25 validated transactions for the active wallet via the existing `xrpl-account-data` edge function (extend it with a `tx_history` action if not already there), diff against the last-seen `tx_hash` stored in localStorage, and synthesize notifications for anything new. Mark them as "while you were away" in the bell, no toast spam.

## Files to touch

- `src/hooks/useXRPLSubscription.ts` — call classifier, push to store
- `src/lib/txClassifier.ts` *(new)* — pure function: `(tx, address, network) => Notification | null`
- `src/stores/notificationStore.ts` *(new)* — Zustand or simple Context + localStorage persistence
- `src/components/NotificationBell.tsx` *(new)* — bell + popover list
- `src/components/Navigation.tsx` — mount `<NotificationBell />`
- `src/contexts/ActiveWalletContext.tsx` — on wallet switch, rehydrate store for that address; on disconnect, no-op (data stays in LS)
- `supabase/functions/xrpl-account-data/index.ts` — add/verify `account_tx` lookup for backfill (only if missing)

## Out of scope

- Email/push notifications
- Notification preferences UI (everything on by default in v1; toggle can come later)
- Notifications for wallets you're not actively viewing (only the `activeWallet` is subscribed)
- DB persistence (option B above)

## Open questions

1. Local-only persistence (A) for v1, or go straight to DB-backed (B)?
2. Should outgoing payments produce a bell entry, or just a toast?
3. Include escrow *created against you* (incoming pending) in v1, or only releases/refunds?