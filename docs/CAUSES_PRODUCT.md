# Causes Product Brief

## Purpose

Causes is a public donation product for Accountabul.

It lets approved campaigns raise funds through XRPL escrow so the platform never takes custody of the money. The Accountabul team curates what appears on the platform, and donors can support a cause through a simple signed-in flow.

## Problem We Are Solving

Existing fundraising platforms can block, restrict, or deplatform campaigns they do not want to support. Causes is built to provide a curated donation experience where:

- donors can sign in and contribute to approved campaigns
- campaigns are reviewed by the Accountabul civil division before going live
- funds move directly into XRPL escrow
- the platform does not hold donor funds
- release happens on a scheduled date to the recipient wallet

## Product Goal

Build a donation marketplace that feels simple for donors, controlled for the team, and trustworthy end-to-end.

The experience should support:

- browsing active causes
- reading clear campaign details
- donating with wallet-based signing
- tracking donation status
- submitting campaign requests for review
- admin approval, rejection, and escrow release

## Current Implementation vs Product Standard

The repo already has a working Causes scaffold from the Lovable build. That scaffold is useful, but the product standard is higher than the initial MVP.

### Already In Place

- public Causes listing page
- campaign detail page
- campaign application page
- admin Causes review page
- XRPL escrow-backed donation flow
- campaign data stored in Supabase
- route wiring in the main app shell

### Upgraded To Product Standard

- search and filter controls on the listing page
- `My Donations` history for signed-in users
- network-aware XRPL explorer links
- campaign video rendering
- signed-in gating for cause submission
- admin release messaging that reflects actual escrow status
- campaign network field for mainnet/testnet awareness
- donation history that can show XRP and USD value snapshots over time

### Still Needs Ongoing Hardening

- escrow release reliability and auditability
- public trust and receipt visibility
- origin and environment defaults for deployed causes endpoints
- clear operator messaging when manual signing is required
- any remaining Lovable-era branding or default URLs outside the Causes flow

## Who It Serves

- Donors who want to support a cause without platform censorship
- Campaign organizers who want to apply for funding
- The Accountabul civil division, which decides what appears publicly
- Internal admins who manage campaign review and escrow release

## Product Principles

1. The platform does not touch the money.
2. Every public campaign is curated by the team.
3. Donor flow should be fast and obvious.
4. Campaign status should be visible at every step.
5. Escrow release must be traceable and honest.

## Scope

### Public Causes Page

- show active and completed campaigns
- explain how XRPL escrow works
- expose clear calls to action for donate and apply
- surface campaign progress and basic trust signals

### Cause Detail Page

- show campaign description, image, goal, release date, and recipient wallet
- show donation history for non-anonymous supported donations
- let signed-in users donate
- show escrow status clearly

### Campaign Submission

- allow users to submit a cause for review
- collect contact details, campaign details, release date, and recipient wallet
- save submissions as under review
- route new submissions through Accountabul review

### Admin Review

- list submitted causes
- approve or reject submissions
- manage active campaigns
- trigger escrow release after the release date

### Escrow Flow

- create escrow when a donation is made
- track donation state from pending to escrowed to released
- support release verification and auditability

## Non-Goals

- general-purpose crowdfunding for every type of campaign
- open self-service publishing without review
- platform-custodied donations
- anonymous campaign publishing without team approval
- browser-side XRPL signing or ledger calls

## MVP Definition

The MVP is complete when a user can:

1. open the Causes page
2. read a campaign
3. sign in
4. donate through XRPL escrow
5. see the donation status update
6. submit a new cause for review
7. have an admin approve, reject, or release a campaign

## Open Product Questions

- Should causes remain a section inside the main platform or become a separate application later?
- Which campaign categories are in scope for launch?
- Should the public page show only active campaigns or also completed ones by default?
- Do we want a stronger donor receipt/history page before launch?

## Success Criteria

- users understand what they are funding
- approved campaigns are easy to browse and donate to
- admins can review and manage campaigns without manual workarounds
- release actions reflect actual escrow state
- the platform stays opinionated and curated rather than open-ended
