
CREATE TABLE public.xrpl_account_cache (
  wallet_address text NOT NULL,
  network text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, network)
);
GRANT ALL ON public.xrpl_account_cache TO service_role;
ALTER TABLE public.xrpl_account_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.xrpl_token_meta_cache (
  currency text NOT NULL,
  issuer text NOT NULL,
  meta jsonb,
  price_xrp numeric,
  market_cap_xrp numeric,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (currency, issuer)
);
GRANT ALL ON public.xrpl_token_meta_cache TO service_role;
ALTER TABLE public.xrpl_token_meta_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.xrpl_kv_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.xrpl_kv_cache TO service_role;
ALTER TABLE public.xrpl_kv_cache ENABLE ROW LEVEL SECURITY;
