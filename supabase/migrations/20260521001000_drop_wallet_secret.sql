-- Remove plaintext testnet wallet secrets from the database.
-- Testnet signing now uses an ephemeral seed stored only in the browser session.

ALTER TABLE public.user_wallets
  DROP COLUMN IF EXISTS wallet_secret;
