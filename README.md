# Accountabul (Hackathon Prototype)

**Status: prototype. Not production ready. Built for the XRP MakeWaves hackathon.**

Accountabul is an experimental web app exploring how community funding, real estate listings, and XRP Ledger
token issuance can live in one place. It is not a bank, broker, dealer, exchange, custodian, or investment
adviser. Nothing in this repository or the deployed preview is an offer to sell securities, and nothing here
promises returns, liquidity, or protection of funds.

---

## Product vision

### DIGITAL SYSTEM (this repository)

- Community funding campaigns ("Causes") with an admin review workflow.
- Standard, non-tokenized real estate listings created by business profiles.
- XRPL wallet connectivity through Xaman, with testnet as the default network.
- Experimental real-world-asset issuance definition on XRPL (MPT / XLS-33).
- KYC intake and admin review tooling.

### PHYSICAL BUSINESS ROADMAP (outside this repository)

Property acquisition, SPV or entity formation, title work, escrow, custody, transfer agent duties, property
management, and distributions are all planned business operations. None of them are implemented in this code
and none of them are represented by any on-chain object created here.

---

## What works today

| Area | State |
|---|---|
| Email / Google sign-in, sessions, idle timeout | Working |
| Business (vendor) profiles and public vendor pages | Working |
| Standard property listings with photo upload | Working |
| Marketplace browsing, filters, standard vs tokenized badges | Working |
| Campaign creation, admin review, donation intake records | Working |
| Xaman wallet connect, wallet list, balances and transaction reads | Working |
| XRPL transaction construction (payments, MPT issuance definition) | Working, testnet oriented |
| Xaman signing of constructed transactions | Working |
| KYC intake plus admin review queue | Working |
| Admin dashboards (users, vendors, credentials, payments) | Working |

## What is simulated, disabled, or planned

| Area | State |
|---|---|
| Buy / sell property tokens | Disabled in the UI, not implemented |
| Order book placement | Disabled, records shown are app database rows, not market data |
| Property token swaps | Quote estimate only, cannot be submitted, no transaction hash is produced |
| Liquidity pools | Placeholder page, no AMM integration |
| Secondary market pricing, charts, yields | Illustrative or lister-supplied, not verified valuations |
| MPT holder authorization and distribution | Not implemented, see `docs/MPT_MINTING.md` |
| Payments rails beyond XRPL and Stripe test mode | Planned |
| Fiat settlement, custody, dividends | Planned, outside this repository |

Any figure shown next to a listing (projected return, rental yield, price per token) is entered by the person
creating the listing. It is not verified, audited, or guaranteed by anyone.

---

## Architecture

```text
React 18 + Vite + TypeScript + Tailwind (SPA)
        |
        |  supabase-js (auth, Postgres with RLS, storage)
        v
Lovable Cloud (Supabase): Postgres, Auth, Storage, Edge Functions (Deno)
        |
        |  edge functions only
        v
XRPL public nodes (testnet by default)  +  Xaman API (signing payloads)
```

Data flow for an XRPL action:

1. The browser asks an edge function to build a transaction (`xrpl-build-mint`, payment builders).
2. The edge function returns unsigned `tx_json`.
3. The browser sends the `tx_json` to `xaman-send-payment`, which creates a Xaman signing payload.
4. The user signs in Xaman. The app polls `xaman-check-payload` for the result.
5. The resulting hash, if any, is stored against the originating record.

The browser never talks to an XRPL node directly and never signs anything itself.

### XRPL testnet / mainnet boundary

- Testnet is the default network for every public flow, including a fresh session and sign-out.
- Mainnet remains selectable, but the network toggle requires an explicit confirmation, and privileged
  mainnet operations stay behind the existing admin and compliance checks.
- There is no one-click public mainnet path.

### Non-custodial signing boundary

- The app stores no wallet seed, secret, or private key: not in the database, not in the browser, not in a
  request body.
- The testnet faucet helper creates a funded testnet address for read-only exploration. Its seed is discarded
  and is not used for signing.
- `src/lib/prototypeSafety.ts` holds the guards for this boundary and is covered by unit tests.

---

## Setup

Requirements: Node.js 18+ and npm (bun also works, the repository ships `bun.lock`).

```sh
npm install
npm run dev
```

### Environment variables

Client variables live in `.env` and are public by design (see `.env.example`):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Server-side values used by edge functions are stored as backend secrets and are never present in the client
bundle: `SUPABASE_SERVICE_ROLE_KEY`, `XAMAN_API_KEY`, `XAMAN_API_SECRET`, `STRIPE_SECRET_KEY`,
`LOVABLE_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`.

### Commands

```sh
npm run dev         # start the dev server
npm run build       # production build
npm run build:dev   # development-mode build
npm run test        # unit tests (vitest)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run preview     # preview a production build
```

---

## Security and regulatory disclaimer

This software is provided as-is for demonstration. It has not been audited. It is not registered with, or
reviewed by, any financial regulator. It is not a securities offering, an investment contract, a solicitation,
or financial advice. Listings are user-generated and unverified; treat them the way you would treat a
classified ad and do your own due diligence. Do not send real funds through this prototype. Real estate
tokenization is regulated in most jurisdictions, and any production version would require legal review,
licensing, and a compliant issuance structure.

---

## Evidence

Fill this table with real hashes and explorer links when a demo run is recorded. No values are invented here.

| Item | Network | Transaction hash | Explorer link |
|---|---|---|---|
| MPT issuance definition created | testnet | (pending) | (pending) |
| XRP payment signed in Xaman | testnet | (pending) | (pending) |
| Credential issuance | testnet | (pending) | (pending) |

---

## Known limitations

- Token holders cannot be authorized or funded from the UI; issuance only creates the definition object.
- No secondary market exists. Trading UI elements are disabled placeholders.
- Listing data is self-reported and unverified.
- KYC review is manual and demo-grade.
- Test coverage is limited to safety-critical helpers.
- Some documentation in `docs/` predates this patch and may describe planned rather than shipped behavior.

## Responsible disclosure

Found a security issue? Please do not open a public issue with exploit details. Contact the maintainers
privately through the repository owner's profile and allow reasonable time for a fix before disclosure.

## Lovable project workflow

This project is developed in [Lovable](https://lovable.dev). Changes made in Lovable are committed to this
repository automatically, and commits pushed here are reflected back in Lovable. You can also edit locally
with any IDE, in GitHub directly, or in a Codespace. Publishing is done from Lovable via Share then Publish.
