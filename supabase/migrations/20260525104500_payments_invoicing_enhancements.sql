-- Payments invoicing enhancements for the property-web3-portal baseline.
-- Adds attachment fields, admin helper compatibility, and a payment creator
-- that persists payment metadata from the payments UI without moving settlement
-- logic into the browser.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'payment',
  ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'person',
  ADD COLUMN IF NOT EXISTS recipient_label TEXT,
  ADD COLUMN IF NOT EXISTS recipient_reference TEXT,
  ADD COLUMN IF NOT EXISTS recipient_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS recipient_location_label TEXT,
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_email TEXT;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_intent_check,
  ADD CONSTRAINT payments_intent_check CHECK (intent IN ('payment', 'invoice'));

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_recipient_type_check,
  ADD CONSTRAINT payments_recipient_type_check CHECK (recipient_type IN ('person', 'business', 'wallet', 'location'));

CREATE INDEX IF NOT EXISTS payments_recipient_reference_idx
  ON public.payments (recipient_reference)
  WHERE recipient_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_recipient_wallet_idx
  ON public.payments (recipient_wallet_address)
  WHERE recipient_wallet_address IS NOT NULL;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.has_role(auth.uid(), 'admin'), false)
    OR COALESCE(public.has_role(auth.uid(), 'compliance_officer'), false);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_payment_and_invoice(
  p_user_id UUID,
  p_idempotency_key TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_rail TEXT,
  p_provider TEXT,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_due_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  payment_row public.payments;
  invoice_row public.payment_invoices;
  normalized_currency TEXT := upper(trim(coalesce(p_currency, '')));
  normalized_rail TEXT := lower(trim(coalesce(p_rail, '')));
  normalized_provider TEXT := lower(trim(coalesce(p_provider, '')));
  normalized_intent TEXT := lower(trim(coalesce(p_metadata ->> 'intent', 'payment')));
  attachment_type TEXT := lower(trim(coalesce(p_metadata #>> '{attachment,type}', 'person')));
  attachment_label TEXT := nullif(trim(coalesce(p_metadata #>> '{attachment,label}', p_title, 'Unassigned')), '');
  attachment_reference TEXT := nullif(trim(coalesce(p_metadata #>> '{attachment,reference}', '')), '');
  attachment_wallet_address TEXT := nullif(trim(coalesce(p_metadata #>> '{attachment,walletAddress}', p_metadata #>> '{attachment,wallet_address}', '')), '');
  attachment_location_label TEXT := nullif(trim(coalesce(p_metadata #>> '{attachment,locationLabel}', '')), '');
  payer_name TEXT := nullif(trim(coalesce(p_metadata #>> '{payer,name}', '')), '');
  payer_email TEXT := nullif(trim(coalesce(p_metadata #>> '{payer,email}', '')), '');
  invoice_number TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF normalized_currency = '' THEN
    RAISE EXCEPTION 'currency is required';
  END IF;

  IF normalized_rail NOT IN ('wallet', 'card') THEN
    RAISE EXCEPTION 'Invalid rail';
  END IF;

  IF normalized_provider NOT IN ('stripe', 'xrpl') THEN
    RAISE EXCEPTION 'Invalid provider';
  END IF;

  IF normalized_intent NOT IN ('payment', 'invoice') THEN
    RAISE EXCEPTION 'Invalid intent';
  END IF;

  IF normalized_rail = 'card' AND normalized_provider <> 'stripe' THEN
    RAISE EXCEPTION 'Card rail must use Stripe';
  END IF;

  IF normalized_rail = 'wallet' AND normalized_provider <> 'xrpl' THEN
    RAISE EXCEPTION 'Wallet rail must use XRPL';
  END IF;

  IF normalized_rail = 'card' AND normalized_currency = 'XRP' THEN
    RAISE EXCEPTION 'Card payments require a fiat currency';
  END IF;

  IF normalized_rail = 'wallet' AND normalized_currency <> 'XRP' THEN
    RAISE EXCEPTION 'Wallet payments currently require XRP';
  END IF;

  IF attachment_type NOT IN ('person', 'business', 'wallet', 'location') THEN
    RAISE EXCEPTION 'Invalid attachment type';
  END IF;

  SELECT *
  INTO payment_row
  FROM public.payments
  WHERE user_id = p_user_id
    AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;

  IF FOUND THEN
    IF payment_row.amount <> p_amount
      OR upper(payment_row.currency) <> normalized_currency
      OR payment_row.rail <> normalized_rail
      OR payment_row.provider <> normalized_provider THEN
      RAISE EXCEPTION 'Idempotency key already used with different payment details';
    END IF;
  ELSE
    INSERT INTO public.payments (
      user_id,
      idempotency_key,
      rail,
      provider,
      intent,
      recipient_type,
      recipient_label,
      recipient_reference,
      recipient_wallet_address,
      recipient_location_label,
      payer_name,
      payer_email,
      status,
      amount,
      currency,
      title,
      description,
      metadata
    )
    VALUES (
      p_user_id,
      trim(p_idempotency_key),
      normalized_rail,
      normalized_provider,
      normalized_intent,
      attachment_type,
      COALESCE(attachment_label, 'Unassigned'),
      attachment_reference,
      CASE
        WHEN attachment_type = 'wallet' THEN COALESCE(attachment_wallet_address, attachment_reference)
        ELSE attachment_wallet_address
      END,
      attachment_location_label,
      payer_name,
      payer_email,
      'pending_payment',
      p_amount,
      normalized_currency,
      p_title,
      p_description,
      COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING * INTO payment_row;
  END IF;

  SELECT *
  INTO invoice_row
  FROM public.payment_invoices
  WHERE payment_id = payment_row.id
  LIMIT 1;

  IF NOT FOUND THEN
    invoice_number := 'INV-' || upper(substr(replace(payment_row.id::text, '-', ''), 1, 12));

    INSERT INTO public.payment_invoices (
      user_id,
      payment_id,
      invoice_number,
      provider,
      status,
      amount,
      currency,
      due_at,
      provider_payload
    )
    VALUES (
      payment_row.user_id,
      payment_row.id,
      invoice_number,
      payment_row.provider,
      'open',
      payment_row.amount,
      payment_row.currency,
      p_due_at,
      COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING * INTO invoice_row;
  END IF;

  RETURN jsonb_build_object(
    'payment', to_jsonb(payment_row),
    'invoice', to_jsonb(invoice_row)
  );
END;
$$;
