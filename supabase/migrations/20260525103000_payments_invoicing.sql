-- Payments and invoicing foundation for server-owned settlement.
-- Payments are distinct from donations and support card (Stripe) and wallet (XRPL/Xaman) rails.

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  rail TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  title TEXT,
  description TEXT,
  provider_reference TEXT,
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_positive CHECK (amount > 0),
  CONSTRAINT payments_rail_check CHECK (rail IN ('wallet', 'card')),
  CONSTRAINT payments_provider_check CHECK (provider IN ('stripe', 'xrpl')),
  CONSTRAINT payments_status_check CHECK (
    status IN (
      'pending_payment',
      'processing',
      'paid',
      'failed',
      'cancelled',
      'expired',
      'refunded',
      'reconciled'
    )
  ),
  CONSTRAINT payments_currency_check CHECK (length(trim(currency)) BETWEEN 3 AND 12)
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_user_idempotency_key_idx
  ON public.payments (user_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_reference_idx
  ON public.payments (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_user_status_idx
  ON public.payments (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_provider_status_idx
  ON public.payments (provider, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  provider_reference TEXT,
  provider_checkout_url TEXT,
  provider_client_secret TEXT,
  payment_uri TEXT,
  destination_address TEXT,
  destination_tag BIGINT,
  memo TEXT,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_invoices_provider_check CHECK (provider IN ('stripe', 'xrpl')),
  CONSTRAINT payment_invoices_status_check CHECK (
    status IN ('draft', 'open', 'paid', 'void', 'expired', 'uncollectible')
  ),
  CONSTRAINT payment_invoices_amount_positive CHECK (amount > 0),
  CONSTRAINT payment_invoices_currency_check CHECK (length(trim(currency)) BETWEEN 3 AND 12)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_invoices_provider_reference_idx
  ON public.payment_invoices (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_invoices_user_status_idx
  ON public.payment_invoices (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_invoices_due_at_idx
  ON public.payment_invoices (due_at)
  WHERE due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_provider_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.payment_invoices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  provider_reference TEXT,
  event_type TEXT NOT NULL,
  event_status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_events_provider_check CHECK (provider IN ('stripe', 'xrpl', 'system'))
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_events_provider_event_id_idx
  ON public.payment_provider_events (provider, provider_event_id);

CREATE INDEX IF NOT EXISTS payment_provider_events_payment_idx
  ON public.payment_provider_events (payment_id, received_at DESC);

CREATE INDEX IF NOT EXISTS payment_provider_events_invoice_idx
  ON public.payment_provider_events (invoice_id, received_at DESC);

CREATE OR REPLACE FUNCTION public.payment_status_allows_transition(
  p_current_status TEXT,
  p_next_status TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_next_status IS NULL THEN false
    WHEN p_current_status IS NULL THEN true
    WHEN p_current_status = p_next_status THEN true
    WHEN p_current_status IN ('paid', 'refunded') THEN p_next_status = 'refunded'
    WHEN p_current_status = 'failed' THEN p_next_status = 'paid'
    WHEN p_current_status = 'cancelled' THEN p_next_status IN ('paid', 'refunded')
    WHEN p_current_status = 'expired' THEN p_next_status IN ('paid', 'refunded')
    WHEN p_current_status = 'reconciled' THEN p_next_status IN ('paid', 'refunded')
    WHEN p_current_status IN ('pending_payment', 'processing') THEN p_next_status IN ('processing', 'paid', 'failed', 'cancelled', 'expired', 'reconciled')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_status_for_payment_status(p_payment_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_payment_status
    WHEN 'paid' THEN 'paid'
    WHEN 'refunded' THEN 'paid'
    WHEN 'cancelled' THEN 'void'
    WHEN 'expired' THEN 'expired'
    WHEN 'failed' THEN 'open'
    WHEN 'processing' THEN 'open'
    WHEN 'pending_payment' THEN 'open'
    WHEN 'reconciled' THEN 'open'
    ELSE 'open'
  END;
$$;

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

  IF normalized_rail = 'card' AND normalized_provider <> 'stripe' THEN
    RAISE EXCEPTION 'Card rail must use Stripe';
  END IF;

  IF normalized_rail = 'wallet' AND normalized_provider <> 'xrpl' THEN
    RAISE EXCEPTION 'Wallet rail must use XRPL';
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

CREATE OR REPLACE FUNCTION public.attach_payment_provider_artifacts(
  p_payment_id UUID,
  p_provider TEXT,
  p_provider_reference TEXT DEFAULT NULL,
  p_payment_payload JSONB DEFAULT '{}'::jsonb,
  p_invoice_payload JSONB DEFAULT '{}'::jsonb,
  p_provider_client_secret TEXT DEFAULT NULL,
  p_provider_checkout_url TEXT DEFAULT NULL,
  p_payment_uri TEXT DEFAULT NULL,
  p_destination_address TEXT DEFAULT NULL,
  p_destination_tag BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  payment_row public.payments;
  invoice_row public.payment_invoices;
  normalized_provider TEXT := lower(trim(coalesce(p_provider, '')));
BEGIN
  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'payment_id is required';
  END IF;

  IF normalized_provider NOT IN ('stripe', 'xrpl') THEN
    RAISE EXCEPTION 'Invalid provider';
  END IF;

  UPDATE public.payments
  SET
    provider = normalized_provider,
    provider_reference = COALESCE(NULLIF(trim(p_provider_reference), ''), provider_reference),
    provider_payload = COALESCE(provider_payload, '{}'::jsonb) || COALESCE(p_payment_payload, '{}'::jsonb),
    status = CASE
      WHEN status = 'pending_payment' THEN 'pending_payment'
      WHEN status = 'processing' THEN 'processing'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO payment_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  UPDATE public.payment_invoices
  SET
    provider = normalized_provider,
    provider_reference = COALESCE(NULLIF(trim(p_provider_reference), ''), provider_reference),
    provider_client_secret = COALESCE(NULLIF(trim(p_provider_client_secret), ''), provider_client_secret),
    provider_checkout_url = COALESCE(NULLIF(trim(p_provider_checkout_url), ''), provider_checkout_url),
    payment_uri = COALESCE(NULLIF(trim(p_payment_uri), ''), payment_uri),
    destination_address = COALESCE(NULLIF(trim(p_destination_address), ''), destination_address),
    destination_tag = COALESCE(p_destination_tag, destination_tag),
    provider_payload = COALESCE(provider_payload, '{}'::jsonb) || COALESCE(p_invoice_payload, '{}'::jsonb),
    status = CASE
      WHEN status = 'draft' THEN 'open'
      ELSE status
    END,
    updated_at = now()
  WHERE payment_id = p_payment_id
  RETURNING * INTO invoice_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  RETURN jsonb_build_object(
    'payment', to_jsonb(payment_row),
    'invoice', to_jsonb(invoice_row)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment_provider_event(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB,
  p_payment_id UUID DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_provider_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized_provider TEXT := lower(trim(coalesce(p_provider, '')));
  normalized_event_type TEXT := lower(trim(coalesce(p_event_type, '')));
  resolved_payment_id UUID := p_payment_id;
  resolved_invoice_id UUID := p_invoice_id;
  payment_row public.payments;
  invoice_row public.payment_invoices;
  event_row public.payment_provider_events;
  resolved_provider_reference TEXT := NULLIF(trim(p_provider_reference), '');
  next_status TEXT;
  invoice_next_status TEXT;
  extracted_payment_id TEXT;
  extracted_destination_tag BIGINT;
BEGIN
  IF normalized_provider NOT IN ('stripe', 'xrpl', 'system') THEN
    RAISE EXCEPTION 'Invalid provider';
  END IF;

  IF p_provider_event_id IS NULL OR length(trim(p_provider_event_id)) < 3 THEN
    RAISE EXCEPTION 'provider_event_id is required';
  END IF;

  IF normalized_event_type = '' THEN
    RAISE EXCEPTION 'event_type is required';
  END IF;

  IF p_payload IS NULL THEN
    p_payload := '{}'::jsonb;
  END IF;

  IF resolved_payment_id IS NULL THEN
    extracted_payment_id := COALESCE(
      p_payload ->> 'payment_id',
      p_payload ->> 'paymentId',
      p_payload #>> '{data,object,metadata,payment_id}',
      p_payload #>> '{data,metadata,payment_id}',
      p_payload #>> '{metadata,payment_id}',
      p_payload #>> '{payment,id}'
    );

    IF extracted_payment_id IS NOT NULL THEN
      BEGIN
        resolved_payment_id := extracted_payment_id::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        resolved_payment_id := NULL;
      END;
    END IF;
  END IF;

  IF resolved_payment_id IS NULL AND resolved_provider_reference IS NOT NULL THEN
    SELECT id
    INTO resolved_payment_id
    FROM public.payments
    WHERE provider = normalized_provider
      AND provider_reference = resolved_provider_reference
    LIMIT 1;
  END IF;

  IF resolved_payment_id IS NULL THEN
    BEGIN
      extracted_destination_tag := COALESCE(
        NULLIF(p_payload ->> 'destination_tag', '')::bigint,
        NULLIF(p_payload ->> 'destinationTag', '')::bigint,
        NULLIF(p_payload #>> '{data,object,destination_tag}', '')::bigint,
        NULLIF(p_payload #>> '{data,object,destinationTag}', '')::bigint
      );
    EXCEPTION WHEN invalid_text_representation THEN
      extracted_destination_tag := NULL;
    END;

    IF extracted_destination_tag IS NOT NULL THEN
      SELECT payment_id
      INTO resolved_payment_id
      FROM public.payment_invoices
      WHERE destination_tag = extracted_destination_tag
      LIMIT 1;
    END IF;
  END IF;

  IF resolved_payment_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve payment for provider event';
  END IF;

  SELECT *
  INTO payment_row
  FROM public.payments
  WHERE id = resolved_payment_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF resolved_provider_reference IS NULL THEN
    resolved_provider_reference := payment_row.provider_reference;
  END IF;

  SELECT *
  INTO invoice_row
  FROM public.payment_invoices
  WHERE payment_id = resolved_payment_id
  LIMIT 1;

  IF NOT FOUND THEN
    resolved_invoice_id := NULL;
  ELSE
    resolved_invoice_id := invoice_row.id;
  END IF;

  INSERT INTO public.payment_provider_events (
    user_id,
    payment_id,
    invoice_id,
    provider,
    provider_event_id,
    provider_reference,
    event_type,
    event_status,
    payload,
    processed_at
  )
  VALUES (
    payment_row.user_id,
    payment_row.id,
    resolved_invoice_id,
    normalized_provider,
    trim(p_provider_event_id),
    resolved_provider_reference,
    normalized_event_type,
    COALESCE((p_payload ->> 'status'), (p_payload ->> 'payment_status')),
    COALESCE(p_payload, '{}'::jsonb),
    now()
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING * INTO event_row;

  IF NOT FOUND THEN
    SELECT *
    INTO event_row
    FROM public.payment_provider_events
    WHERE provider = normalized_provider
      AND provider_event_id = trim(p_provider_event_id)
    LIMIT 1;

    RETURN jsonb_build_object(
      'payment', to_jsonb(payment_row),
      'invoice', CASE WHEN invoice_row.id IS NULL THEN NULL ELSE to_jsonb(invoice_row) END,
      'event', to_jsonb(event_row),
      'inserted', false
    );
  END IF;

  next_status := CASE
    WHEN normalized_provider = 'stripe' AND normalized_event_type IN ('payment_intent.succeeded', 'checkout.session.completed', 'invoice.paid') THEN 'paid'
    WHEN normalized_provider = 'stripe' AND normalized_event_type IN ('payment_intent.processing', 'payment_intent.requires_action') THEN 'processing'
    WHEN normalized_provider = 'stripe' AND normalized_event_type IN ('payment_intent.payment_failed', 'payment_intent.canceled', 'invoice.voided') THEN CASE normalized_event_type WHEN 'payment_intent.canceled' THEN 'cancelled' WHEN 'invoice.voided' THEN 'cancelled' ELSE 'failed' END
    WHEN normalized_provider = 'stripe' AND normalized_event_type IN ('charge.refunded', 'refund.created') THEN 'refunded'
    WHEN normalized_provider = 'xrpl' AND normalized_event_type IN ('payment.settled', 'payment.completed', 'transaction.validated') THEN 'paid'
    WHEN normalized_provider = 'xrpl' AND normalized_event_type IN ('payment.processing', 'transaction.submitted') THEN 'processing'
    WHEN normalized_provider = 'xrpl' AND normalized_event_type IN ('payment.failed', 'transaction.failed') THEN 'failed'
    WHEN normalized_provider = 'xrpl' AND normalized_event_type IN ('payment.cancelled', 'transaction.cancelled') THEN 'cancelled'
    WHEN normalized_provider = 'xrpl' AND normalized_event_type IN ('payment.expired') THEN 'expired'
    WHEN normalized_provider = 'system' AND normalized_event_type IN ('invoice.expired', 'payment.expired') THEN 'expired'
    WHEN normalized_provider = 'system' AND normalized_event_type IN ('payment.reconciled', 'invoice.reconciled') THEN 'reconciled'
    ELSE NULL
  END;

  IF next_status IS NOT NULL AND public.payment_status_allows_transition(payment_row.status, next_status) THEN
    UPDATE public.payments
    SET
      status = next_status,
      provider_reference = COALESCE(NULLIF(trim(resolved_provider_reference), ''), provider_reference),
      provider_payload = COALESCE(provider_payload, '{}'::jsonb) || COALESCE(p_payload, '{}'::jsonb),
      paid_at = CASE WHEN next_status IN ('paid', 'refunded') THEN COALESCE(paid_at, now()) ELSE paid_at END,
      settled_at = CASE WHEN next_status IN ('paid', 'refunded') THEN COALESCE(settled_at, now()) ELSE settled_at END,
      reconciled_at = CASE WHEN normalized_provider = 'system' OR next_status = 'paid' THEN COALESCE(reconciled_at, now()) ELSE reconciled_at END,
      failed_at = CASE WHEN next_status = 'failed' THEN COALESCE(failed_at, now()) ELSE failed_at END,
      cancelled_at = CASE WHEN next_status = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END,
      expired_at = CASE WHEN next_status = 'expired' THEN COALESCE(expired_at, now()) ELSE expired_at END,
      updated_at = now()
    WHERE id = payment_row.id
    RETURNING * INTO payment_row;
  END IF;

  invoice_next_status := public.invoice_status_for_payment_status(payment_row.status);

  IF invoice_row.id IS NOT NULL THEN
    UPDATE public.payment_invoices
    SET
      status = invoice_next_status,
      provider_reference = COALESCE(NULLIF(trim(resolved_provider_reference), ''), provider_reference),
      provider_payload = COALESCE(provider_payload, '{}'::jsonb) || COALESCE(p_payload, '{}'::jsonb),
      provider_checkout_url = COALESCE(
        NULLIF(trim(COALESCE(p_payload ->> 'provider_checkout_url', p_payload ->> 'checkout_url')), ''),
        provider_checkout_url
      ),
      provider_client_secret = COALESCE(
        NULLIF(trim(COALESCE(p_payload ->> 'provider_client_secret', p_payload ->> 'client_secret')), ''),
        provider_client_secret
      ),
      payment_uri = COALESCE(NULLIF(trim(p_payload ->> 'payment_uri'), ''), payment_uri),
      destination_address = COALESCE(NULLIF(trim(p_payload ->> 'destination_address'), ''), destination_address),
      destination_tag = COALESCE(
        NULLIF(p_payload ->> 'destination_tag', '')::bigint,
        destination_tag
      ),
      paid_at = CASE WHEN payment_row.status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
      voided_at = CASE WHEN payment_row.status = 'cancelled' THEN COALESCE(voided_at, now()) ELSE voided_at END,
      expired_at = CASE WHEN payment_row.status = 'expired' THEN COALESCE(expired_at, now()) ELSE expired_at END,
      updated_at = now()
    WHERE id = invoice_row.id
    RETURNING * INTO invoice_row;
  END IF;

  RETURN jsonb_build_object(
    'payment', to_jsonb(payment_row),
    'invoice', CASE WHEN invoice_row.id IS NULL THEN NULL ELSE to_jsonb(invoice_row) END,
    'event', to_jsonb(event_row),
    'inserted', true
  );
END;
$$;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments"
  ON public.payments FOR SELECT
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "Users can view their own invoices" ON public.payment_invoices;
CREATE POLICY "Users can view their own invoices"
  ON public.payment_invoices FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all invoices" ON public.payment_invoices;
CREATE POLICY "Admins can view all invoices"
  ON public.payment_invoices FOR SELECT
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "Users can view their own payment events" ON public.payment_provider_events;
CREATE POLICY "Users can view their own payment events"
  ON public.payment_provider_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all payment events" ON public.payment_provider_events;
CREATE POLICY "Admins can view all payment events"
  ON public.payment_provider_events FOR SELECT
  USING (public.current_user_is_admin());

GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.payment_invoices TO authenticated;
GRANT SELECT ON public.payment_provider_events TO authenticated;

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_invoices_updated_at ON public.payment_invoices;
CREATE TRIGGER update_payment_invoices_updated_at
BEFORE UPDATE ON public.payment_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
