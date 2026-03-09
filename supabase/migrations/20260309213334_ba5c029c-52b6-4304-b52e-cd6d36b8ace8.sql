
ALTER TABLE public.credential_catalog
  ADD COLUMN application_mode text NOT NULL DEFAULT 'user_apply',
  ADD COLUMN user_benefit text,
  ADD COLUMN user_cta text;
