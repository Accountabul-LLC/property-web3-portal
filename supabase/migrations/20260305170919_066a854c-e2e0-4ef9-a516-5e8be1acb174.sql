ALTER TABLE public.user_wallets ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT 'mainnet';

UPDATE public.user_wallets SET network = 'testnet' WHERE provider = 'testnet_faucet';