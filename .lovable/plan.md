# Escrow Release Notifications — Recipient + Donor

## Goal

When the cron releases a campaign's escrow:
- **Recipient** gets an in-app bell notification (with sound) + email (if they're an app user with an email).
- **Donor** gets an in-app "thank you, your donation was delivered" notification + email.

Today the bell only fires when the recipient's wallet is actively connected and watching XRPL — that's why LFFW saw nothing. We'll move notifications server-side so they survive across sessions and devices, and wire emails through Lovable Emails.

## What to build

### 1. Database: `user_notifications` table

```text
user_notifications
  id, user_id, kind, title, body,
  campaign_id, donation_id, tx_hash, amount, currency,
  network, read_at, created_at
```

- RLS: users can read/update their own rows; service role inserts.
- Realtime enabled on the table so the bell updates live.

### 2. Notification dispatch in `_shared/campaign-release.ts`

After each successful `EscrowFinish`:

- Look up `recipient_user_id` by `recipient_wallet_address` in `user_wallets` (active).
- Look up `donor_user_id` from the `campaign_donations` row.
- Insert two rows into `user_notifications`:
  - Recipient: "Escrow released: X XRP from {campaign}" → links to tx
  - Donor: "Thank you — your donation to {campaign} was delivered" → links to tx
- Then enqueue emails (see step 4) for whichever side has an email on file.

This runs inside the cron path, so it works whether or not anyone is logged in.

### 3. Frontend: in-app bell upgrade

- New hook `useServerNotifications()` — queries `user_notifications` for the signed-in user, subscribes to realtime INSERTs.
- `NotificationBell` shows the union of (a) server notifications for the user and (b) existing wallet-scoped localStorage notifications. Server ones take priority.
- On new realtime INSERT: play a short sound (`/notification.mp3`, ~0.3s ping) + toast.
- Sound is muted if tab is hidden / user has interacted-mute preference (saved to localStorage).
- Mark-read writes back to `user_notifications.read_at`.

### 4. Emails (Lovable Emails)

- Set up email domain + infrastructure (one-time dialog if not configured).
- Scaffold transactional email function `send-transactional-email`.
- Two templates:
  - `escrow-released-recipient` — "You received {amount} {currency} from {campaign}"
  - `donation-delivered-donor` — "Thank you — your donation was delivered"
- Cron release path calls `send-transactional-email` for each side after insert, using `profiles.email` (recipient resolved via wallet → user_id → profile).

### 5. Test it end-to-end

- Create a test campaign with release ~2 min out.
- Donate from wallet A.
- Confirm after cron runs:
  - Recipient (wallet B's user) sees bell + sound + email.
  - Donor (wallet A's user) sees thank-you bell + email.
  - Campaign card flips to completed live (already works).

## Technical notes

- `recipient_wallet_address` → user resolution: `user_wallets` where `status='active'`. If no match (external wallet), skip the in-app notification but still log; no email.
- Email is best-effort: failures don't block release. Logged in `app_audit_log`.
- Sound asset: tiny royalty-free ping, lazy-loaded, played via `new Audio()` only on realtime INSERT (not on initial fetch / backfill).
- Migration adds `REPLICA IDENTITY FULL` + publication for `user_notifications`.

## Open question

Do you already have an email domain configured for this project, or should the first step open the email-domain setup dialog? (Without it, the in-app bell + sound still works; only emails are blocked.)
