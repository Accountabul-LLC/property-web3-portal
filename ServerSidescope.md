# Server Side Scope

This file defines the trust boundary for Accountabul / Property Web3 Portal.

## Rule Of Thumb

- The browser may request actions.
- The server decides whether the action is allowed.
- The server performs any mutation that changes money, permissions, ownership, audit history, or irreversible product state.

## Must Stay Server Side

These actions must not be performed by direct browser writes:

- Campaign create, update, review, delete, and release actions
- Campaign type selection and all evergreen/direct donation paths
- Donation release and escrow settlement
- Action item create, update, delete, and GitHub sync actions
- Agent integration toggle actions
- XRPL issuer wallet registration
- Debate transcript/session persistence
- Any audit log insert or mutation
- Any secret, signer, service-role, cron, or vault-backed operation

## Browser Allowed

The browser can safely:

- Read public or owner-scoped data through RLS
- Request server-side actions through edge functions
- Hold publishable keys and session access tokens
- Manage local UI state, optimistic state, and drafts that are not authoritative

## Current Server-Owned Mutation Paths

- `campaign-submit`
- `campaign-admin`
- `campaign-release`
- `campaign-release-due`
- `action-item-admin`
- `admin-integrations`
- `issuer-wallet-register`
- `debate-session-save`

## Security Invariants

- No production wallet seed may live in browser storage.
- No service-role key may ship to the browser.
- No admin-only table mutation should depend on client-side inspection or hidden form fields.
- Any money movement must be validated and executed on the server.
- Any audit log must be written on the server.

## Audit Notes

The following client-side writes were identified and moved or are intended to stay server-side:

- Causes campaign writes and donation release flows
- Escrow and direct campaign donation flows, including recipient activation and DepositAuth preflight checks
- XRPL validation and engine-result mapping for donation signing flows
- Action item management and GitHub sync
- Integration toggles
- XRPL issuer wallet registration
- Debate session persistence

Any new feature should be added here before implementation so the trust boundary stays explicit.
