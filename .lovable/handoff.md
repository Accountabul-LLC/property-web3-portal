## Causes Handoff

The Causes escrow auto-release flow now expects a dedicated XRPL signer wallet.

Set these Supabase secrets after the push:

- `CAMPAIGN_RELEASE_SIGNER_SEED`
- `CAMPAIGN_RELEASE_SIGNER_ALGORITHM=secp256k1`

Notes:

- The signer wallet is only for Causes escrow release.
- Do not store the seed in the repo.
- The cron secret naming should stay consistent across the migration and edge function.
- Causes release actions must stay server-side:
  - the browser only uses the publishable key
  - the release signer seed lives in Supabase secrets
  - the auto-release cron calls `campaign-release-due` with the dedicated cron secret
- Browser-held wallet secrets are testnet-only convenience data. Do not extend that path to production wallets or Causes release flows.
