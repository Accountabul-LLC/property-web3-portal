
ALTER TABLE public.kyc_cases
  ADD COLUMN IF NOT EXISTS stripe_verification_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_verification_status text,
  ADD COLUMN IF NOT EXISTS stripe_last_event_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_kyc_cases_stripe_vs
  ON public.kyc_cases(stripe_verification_session_id);
