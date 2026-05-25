# Humanize Transaction Labels

Right now the Recent Transactions list shows raw XRPL types ("EscrowFinish", "EscrowCreate", "TrustSet", "DIDSet"). Notifications already use friendlier phrasing, but it's inconsistent. This plan unifies everything behind a single helper so the user always sees natural language.

## What changes (UI only)

In the activity list, replace raw types with phrases based on direction + type:

| XRPL type | Direction | New label |
|---|---|---|
| Payment | received | "Received payment" |
| Payment | sent | "Sent payment" |
| EscrowCreate | sent (you funded it) | "Escrow created" |
| EscrowCreate | received (someone funded you) | "Incoming escrow" |
| EscrowFinish | received | "Escrow released to you" |
| EscrowFinish | sent | "Escrow released" |
| EscrowCancel | any | "Escrow refunded" |
| OfferCreate | — | "DEX order placed" |
| OfferCancel | — | "DEX order cancelled" |
| TrustSet | — | "Trustline updated" |
| AccountSet | — | "Account settings updated" |
| NFTokenMint | — | "NFT minted" |
| NFTokenCreateOffer | — | "NFT offer created" |
| NFTokenAcceptOffer | — | "NFT offer accepted" |
| MPTokenIssuanceCreate | — | "Token issued" |
| MPTokenAuthorize | — | "Token authorized" |
| Payment (is_swap) | — | "Token swap" |
| DIDSet | — | "Identity updated" |
| DIDDelete | — | "Identity removed" |
| CredentialCreate | sent | "Credential issued" |
| CredentialCreate | received | "Credential received" |
| CredentialAccept | — | "Credential accepted" |
| CredentialDelete | — | "Credential revoked" |
| (unknown) | — | prettified type (e.g. "Set Regular Key") |

Tooltip on hover still shows the raw XRPL type for power users.

## Files touched

- **new** `src/lib/txLabels.ts` — single `humanizeTx({ type, direction, is_swap })` helper plus a `prettifyType` fallback that splits PascalCase into words.
- `src/components/PortfolioSection.tsx` — replace the inline `txLabel` ternary (~line 998-1002) with `humanizeTx(tx)`, and wrap the label `<p>` in a `title={tx.type}` for the raw type on hover.
- `src/lib/txClassifier.ts` — keep notification titles as-is (already friendly), but route through the same helper for consistency where applicable (escrow titles already match).
- `src/components/WalletActivityWatcher.tsx` — same: align backfilled notification titles with the helper.

No backend/edge-function changes. No DB changes. No behavior changes — only label text.

## Out of scope

- Restructuring the transaction shape returned by `xrpl-account-data`.
- Credential-flow surfacing in the activity list (we already label what the parser emits; if credentials don't currently appear, that's a separate parser task).
