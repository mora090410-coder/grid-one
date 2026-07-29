-- Stripe checkout lifecycle, non-stacking fulfillment, and entitlement
-- revocation/restoration. All state transitions are additive and preserve
-- board activations and published viewer snapshots.

ALTER TABLE public.checkout_orders
  DROP CONSTRAINT IF EXISTS checkout_orders_status_check;

ALTER TABLE public.checkout_orders
  ADD CONSTRAINT checkout_orders_status_check
  CHECK (
    status IN (
      'pending',
      'checkout_created',
      'awaiting_payment',
      'paid',
      'duplicate_paid',
      'failed',
      'expired',
      'refunded',
      'disputed'
    )
  );

ALTER TABLE public.checkout_orders
  ADD COLUMN entitlement_id uuid REFERENCES public.season_entitlements(id) ON DELETE SET NULL,
  ADD COLUMN duplicate_of_order_id uuid REFERENCES public.checkout_orders(id) ON DELETE SET NULL,
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN stripe_charge_id text,
  ADD COLUMN stripe_expires_at timestamptz,
  ADD COLUMN stripe_session_expired_at timestamptz,
  ADD COLUMN terminal_at timestamptz,
  ADD COLUMN terminal_reason text CHECK (char_length(terminal_reason) <= 160),
  ADD COLUMN refundable_at timestamptz,
  ADD COLUMN amount_refunded_cents integer NOT NULL DEFAULT 0 CHECK (amount_refunded_cents >= 0),
  ADD COLUMN last_event_at timestamptz;

CREATE UNIQUE INDEX checkout_orders_stripe_charge_key
  ON public.checkout_orders (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

ALTER TABLE public.season_entitlements
  ADD COLUMN source_checkout_order_id uuid REFERENCES public.checkout_orders(id) ON DELETE SET NULL,
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revocation_reason text CHECK (char_length(revocation_reason) <= 160),
  ADD COLUMN revoked_by_event_id text,
  ADD COLUMN restored_at timestamptz,
  ADD COLUMN restored_by_event_id text;

ALTER TABLE public.stripe_events
  ADD COLUMN owner_id uuid,
  ADD COLUMN season_year smallint,
  ADD COLUMN outcome text NOT NULL DEFAULT 'processed'
    CHECK (char_length(outcome) BETWEEN 1 AND 80),
  ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object');

CREATE TABLE public.checkout_order_disputes (
  dispute_id text PRIMARY KEY,
  checkout_order_id uuid NOT NULL REFERENCES public.checkout_orders(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (
    status IN (
      'warning_needs_response',
      'warning_under_review',
      'warning_closed',
      'needs_response',
      'under_review',
      'won',
      'lost'
    )
  ),
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[a-z]{3}$'),
  opened_event_id text,
  closed_event_id text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX checkout_order_disputes_opened_event_key
  ON public.checkout_order_disputes (opened_event_id)
  WHERE opened_event_id IS NOT NULL;

CREATE UNIQUE INDEX checkout_order_disputes_closed_event_key
  ON public.checkout_order_disputes (closed_event_id)
  WHERE closed_event_id IS NOT NULL;

CREATE TABLE public.entitlement_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entitlement_id uuid REFERENCES public.season_entitlements(id) ON DELETE SET NULL,
  checkout_order_id uuid REFERENCES public.checkout_orders(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  season_year smallint NOT NULL,
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 80),
  previous_status text,
  next_status text,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 160),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_order_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.checkout_order_disputes FROM anon, authenticated;
REVOKE ALL ON TABLE public.entitlement_audit_events FROM anon, authenticated;
GRANT ALL ON TABLE public.checkout_order_disputes TO service_role;
GRANT ALL ON TABLE public.entitlement_audit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.entitlement_audit_events_id_seq TO service_role;

-- Migration 007 allowed one open order per board. Collapse any historical
-- cross-board duplicates before changing the invariant to one open order per
-- owner and season. Rows remain available for audit and remote-session cleanup.
WITH ranked_open_orders AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY owner_id, season_year
      ORDER BY created_at DESC, id DESC
    ) AS open_rank
  FROM public.checkout_orders
  WHERE status IN ('pending', 'checkout_created')
)
UPDATE public.checkout_orders checkout_order
SET
  status = 'expired',
  terminal_at = coalesce(checkout_order.terminal_at, now()),
  terminal_reason = coalesce(
    checkout_order.terminal_reason,
    'superseded_by_owner_season_scope'
  ),
  updated_at = now()
FROM ranked_open_orders ranked
WHERE checkout_order.id = ranked.id
  AND ranked.open_rank > 1;

DROP INDEX public.checkout_orders_one_open_key;

CREATE UNIQUE INDEX checkout_orders_one_open_key
  ON public.checkout_orders (owner_id, season_year)
  WHERE status IN ('pending', 'checkout_created', 'awaiting_payment');

CREATE OR REPLACE FUNCTION public.gridone_claim_checkout_order(
  p_owner_id uuid,
  p_contest_id uuid,
  p_season_year smallint,
  p_price_id text,
  p_price_cents integer,
  p_currency text
)
RETURNS TABLE (
  order_id uuid,
  order_status text,
  stripe_checkout_session_id text,
  entitlement_status text,
  already_entitled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  contest_row public.contests%ROWTYPE;
  entitlement_row public.season_entitlements%ROWTYPE;
  order_row public.checkout_orders%ROWTYPE;
BEGIN
  IF p_price_cents < 0 OR lower(p_currency) !~ '^[a-z]{3}$' THEN
    RAISE EXCEPTION 'Invalid checkout price';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text || ':' || p_season_year::text, 0)
  );

  SELECT *
    INTO contest_row
  FROM public.contests contest
  WHERE contest.id = p_contest_id
    AND contest.owner_id = p_owner_id
    AND contest.season_year = p_season_year;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest is not owned by this user for this season';
  END IF;

  SELECT *
    INTO entitlement_row
  FROM public.season_entitlements entitlement
  WHERE entitlement.owner_id = p_owner_id
    AND entitlement.season_year = p_season_year
  FOR UPDATE;

  IF FOUND AND entitlement_row.status = 'active' THEN
    RETURN QUERY SELECT
      NULL::uuid,
      NULL::text,
      NULL::text,
      entitlement_row.status,
      true;
    RETURN;
  END IF;

  SELECT *
    INTO order_row
  FROM public.checkout_orders checkout_order
  WHERE checkout_order.owner_id = p_owner_id
    AND checkout_order.season_year = p_season_year
    AND checkout_order.status IN ('pending', 'checkout_created', 'awaiting_payment')
  ORDER BY checkout_order.created_at DESC, checkout_order.id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY SELECT
      order_row.id,
      order_row.status,
      order_row.stripe_checkout_session_id,
      entitlement_row.status,
      false;
    RETURN;
  END IF;

  INSERT INTO public.checkout_orders (
    owner_id,
    contest_id,
    season_year,
    price_id,
    price_cents,
    currency
  )
  VALUES (
    p_owner_id,
    p_contest_id,
    p_season_year,
    p_price_id,
    p_price_cents,
    lower(p_currency)
  )
  RETURNING * INTO order_row;

  RETURN QUERY SELECT
    order_row.id,
    order_row.status,
    order_row.stripe_checkout_session_id,
    entitlement_row.status,
    false;
END;
$$;

CREATE OR REPLACE FUNCTION public.gridone_attach_checkout_session(
  p_order_id uuid,
  p_session_id text,
  p_expires_at timestamptz
)
RETURNS TABLE (
  order_id uuid,
  order_status text,
  stripe_checkout_session_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  order_row public.checkout_orders%ROWTYPE;
BEGIN
  SELECT *
    INTO order_row
  FROM public.checkout_orders checkout_order
  WHERE checkout_order.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout order not found';
  END IF;
  IF order_row.status NOT IN ('pending', 'checkout_created') THEN
    RAISE EXCEPTION 'Checkout order is not open';
  END IF;
  IF order_row.stripe_checkout_session_id IS NOT NULL
    AND order_row.stripe_checkout_session_id <> p_session_id
  THEN
    RAISE EXCEPTION 'Checkout order already has a different session';
  END IF;

  UPDATE public.checkout_orders checkout_order
  SET
    status = 'checkout_created',
    stripe_checkout_session_id = p_session_id,
    stripe_expires_at = p_expires_at,
    updated_at = now()
  WHERE checkout_order.id = order_row.id
  RETURNING * INTO order_row;

  RETURN QUERY SELECT
    order_row.id,
    order_row.status,
    order_row.stripe_checkout_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gridone_record_checkout_session_event(
  p_event_id text,
  p_event_type text,
  p_order_id uuid,
  p_session_id text,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  outcome text,
  order_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  order_row public.checkout_orders%ROWTYPE;
  prior_outcome text;
  result_outcome text;
  inserted_count integer;
BEGIN
  SELECT stripe_event.outcome
    INTO prior_outcome
  FROM public.stripe_events stripe_event
  WHERE stripe_event.event_id = p_event_id;

  IF FOUND THEN
    SELECT checkout_order.status
      INTO order_row.status
    FROM public.checkout_orders checkout_order
    WHERE checkout_order.id = p_order_id;
    RETURN QUERY SELECT prior_outcome, order_row.status;
    RETURN;
  END IF;

  SELECT *
    INTO order_row
  FROM public.checkout_orders checkout_order
  WHERE checkout_order.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout order not found';
  END IF;
  IF order_row.stripe_checkout_session_id IS NOT NULL
    AND order_row.stripe_checkout_session_id <> p_session_id
  THEN
    RAISE EXCEPTION 'Checkout session does not match the order';
  END IF;

  INSERT INTO public.stripe_events (
    event_id,
    event_type,
    checkout_order_id,
    owner_id,
    season_year,
    outcome
  )
  VALUES (
    p_event_id,
    p_event_type,
    order_row.id,
    order_row.owner_id,
    order_row.season_year,
    'processing'
  )
  ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN
    SELECT stripe_event.outcome
      INTO prior_outcome
    FROM public.stripe_events stripe_event
    WHERE stripe_event.event_id = p_event_id;
    RETURN QUERY SELECT prior_outcome, order_row.status;
    RETURN;
  END IF;

  IF order_row.status IN ('paid', 'duplicate_paid', 'refunded', 'disputed') THEN
    result_outcome := 'ignored_terminal';
  ELSIF p_event_type = 'checkout.session.completed'
    AND p_status = 'awaiting_payment'
  THEN
    UPDATE public.checkout_orders checkout_order
    SET
      status = 'awaiting_payment',
      stripe_checkout_session_id = coalesce(
        checkout_order.stripe_checkout_session_id,
        p_session_id
      ),
      last_event_at = now(),
      updated_at = now()
    WHERE checkout_order.id = order_row.id
    RETURNING * INTO order_row;
    result_outcome := 'awaiting_payment';
  ELSIF p_event_type = 'checkout.session.async_payment_failed' THEN
    UPDATE public.checkout_orders checkout_order
    SET
      status = 'failed',
      terminal_at = coalesce(checkout_order.terminal_at, now()),
      terminal_reason = coalesce(
        nullif(p_reason, ''),
        'async_payment_failed'
      ),
      last_event_at = now(),
      updated_at = now()
    WHERE checkout_order.id = order_row.id
    RETURNING * INTO order_row;
    result_outcome := 'payment_failed';
  ELSIF p_event_type = 'checkout.session.expired' THEN
    UPDATE public.checkout_orders checkout_order
    SET
      status = 'expired',
      terminal_at = coalesce(checkout_order.terminal_at, now()),
      terminal_reason = coalesce(
        nullif(p_reason, ''),
        'checkout_session_expired'
      ),
      stripe_session_expired_at = coalesce(
        checkout_order.stripe_session_expired_at,
        now()
      ),
      last_event_at = now(),
      updated_at = now()
    WHERE checkout_order.id = order_row.id
    RETURNING * INTO order_row;
    result_outcome := 'checkout_expired';
  ELSE
    result_outcome := 'ignored_unactionable';
  END IF;

  UPDATE public.stripe_events stripe_event
  SET outcome = result_outcome
  WHERE stripe_event.event_id = p_event_id;

  RETURN QUERY SELECT result_outcome, order_row.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.gridone_fulfill_checkout_v2(
  p_event_id text,
  p_event_type text,
  p_order_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_customer_id text,
  p_price_id text,
  p_price_cents integer,
  p_currency text
)
RETURNS TABLE (
  outcome text,
  contest_id uuid,
  owner_id uuid,
  season_year smallint,
  entitlement_id uuid,
  activated boolean,
  used integer,
  allowance integer,
  refundable boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  order_row public.checkout_orders%ROWTYPE;
  entitlement_row public.season_entitlements%ROWTYPE;
  activation_result record;
  prior_outcome text;
  result_outcome text;
  previous_entitlement_status text;
  used_count integer := 0;
  is_activated boolean := false;
  is_same_source boolean := false;
  inserted_count integer;
BEGIN
  SELECT *
    INTO order_row
  FROM public.checkout_orders checkout_order
  WHERE checkout_order.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout order not found';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      order_row.owner_id::text || ':' || order_row.season_year::text,
      0
    )
  );

  SELECT *
    INTO order_row
  FROM public.checkout_orders checkout_order
  WHERE checkout_order.id = p_order_id
  FOR UPDATE;

  SELECT stripe_event.outcome
    INTO prior_outcome
  FROM public.stripe_events stripe_event
  WHERE stripe_event.event_id = p_event_id;

  IF FOUND THEN
    SELECT *
      INTO entitlement_row
    FROM public.season_entitlements entitlement
    WHERE entitlement.owner_id = order_row.owner_id
      AND entitlement.season_year = order_row.season_year;
    IF FOUND THEN
      SELECT count(*)::integer
        INTO used_count
      FROM public.board_activations activation
      WHERE activation.entitlement_id = entitlement_row.id;
      SELECT EXISTS (
        SELECT 1
        FROM public.board_activations activation
        WHERE activation.contest_id = order_row.contest_id
      ) INTO is_activated;
    END IF;
    RETURN QUERY SELECT
      prior_outcome,
      order_row.contest_id,
      order_row.owner_id,
      order_row.season_year,
      entitlement_row.id,
      is_activated,
      used_count,
      coalesce(entitlement_row.boards_allowance::integer, 0),
      order_row.refundable_at IS NOT NULL;
    RETURN;
  END IF;

  IF order_row.price_id <> p_price_id
    OR order_row.price_cents <> p_price_cents
    OR order_row.currency <> lower(p_currency)
  THEN
    RAISE EXCEPTION 'Checkout price does not match the order';
  END IF;
  IF p_payment_intent_id IS NULL OR p_payment_intent_id = '' THEN
    RAISE EXCEPTION 'Checkout payment intent is missing';
  END IF;
  IF order_row.stripe_checkout_session_id IS NOT NULL
    AND order_row.stripe_checkout_session_id <> p_session_id
  THEN
    RAISE EXCEPTION 'Checkout session does not match the order';
  END IF;

  INSERT INTO public.stripe_events (
    event_id,
    event_type,
    checkout_order_id,
    owner_id,
    season_year,
    outcome
  )
  VALUES (
    p_event_id,
    p_event_type,
    order_row.id,
    order_row.owner_id,
    order_row.season_year,
    'processing'
  )
  ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN
    SELECT stripe_event.outcome
      INTO prior_outcome
    FROM public.stripe_events stripe_event
    WHERE stripe_event.event_id = p_event_id;
    RETURN QUERY SELECT
      prior_outcome,
      order_row.contest_id,
      order_row.owner_id,
      order_row.season_year,
      order_row.entitlement_id,
      false,
      0,
      0,
      order_row.refundable_at IS NOT NULL;
    RETURN;
  END IF;

  IF order_row.status IN ('duplicate_paid', 'refunded', 'disputed') THEN
    result_outcome := CASE
      WHEN order_row.status = 'duplicate_paid' THEN 'duplicate_payment'
      ELSE 'ignored_terminal'
    END;
    UPDATE public.stripe_events stripe_event
    SET outcome = result_outcome
    WHERE stripe_event.event_id = p_event_id;
    RETURN QUERY SELECT
      result_outcome,
      order_row.contest_id,
      order_row.owner_id,
      order_row.season_year,
      order_row.entitlement_id,
      false,
      0,
      0,
      order_row.refundable_at IS NOT NULL;
    RETURN;
  END IF;

  SELECT *
    INTO entitlement_row
  FROM public.season_entitlements entitlement
  WHERE entitlement.owner_id = order_row.owner_id
    AND entitlement.season_year = order_row.season_year
  FOR UPDATE;

  IF FOUND THEN
    previous_entitlement_status := entitlement_row.status;
    is_same_source := entitlement_row.source_checkout_order_id = order_row.id
      OR (
        entitlement_row.source_checkout_order_id IS NULL
        AND (
          entitlement_row.stripe_checkout_session_id = p_session_id
          OR entitlement_row.stripe_payment_intent_id = p_payment_intent_id
        )
      );
  END IF;

  IF order_row.status = 'paid'
    AND order_row.stripe_payment_intent_id = p_payment_intent_id
  THEN
    result_outcome := 'already_fulfilled';
  ELSIF entitlement_row.status = 'active' AND is_same_source THEN
    UPDATE public.checkout_orders checkout_order
    SET
      entitlement_id = entitlement_row.id,
      stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = p_payment_intent_id,
      stripe_customer_id = nullif(p_customer_id, ''),
      status = 'paid',
      paid_at = coalesce(checkout_order.paid_at, now()),
      last_event_at = now(),
      updated_at = now()
    WHERE checkout_order.id = order_row.id
    RETURNING * INTO order_row;

    UPDATE public.season_entitlements entitlement
    SET
      source_checkout_order_id = coalesce(
        entitlement.source_checkout_order_id,
        order_row.id
      ),
      updated_at = now()
    WHERE entitlement.id = entitlement_row.id
    RETURNING * INTO entitlement_row;
    result_outcome := 'already_fulfilled';
  ELSIF entitlement_row.status = 'active' THEN
    UPDATE public.checkout_orders checkout_order
    SET
      entitlement_id = entitlement_row.id,
      duplicate_of_order_id = entitlement_row.source_checkout_order_id,
      status = 'duplicate_paid',
      stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = p_payment_intent_id,
      stripe_customer_id = nullif(p_customer_id, ''),
      paid_at = coalesce(checkout_order.paid_at, now()),
      refundable_at = coalesce(checkout_order.refundable_at, now()),
      terminal_at = coalesce(checkout_order.terminal_at, now()),
      terminal_reason = 'duplicate_owner_season_payment',
      last_event_at = now(),
      updated_at = now()
    WHERE checkout_order.id = order_row.id
    RETURNING * INTO order_row;
    result_outcome := 'duplicate_payment';
  ELSE
    IF entitlement_row.id IS NULL THEN
      INSERT INTO public.season_entitlements (
        owner_id,
        season_year,
        status,
        boards_allowance,
        price_cents,
        currency,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        stripe_customer_id,
        stripe_price_id,
        purchased_at,
        source_checkout_order_id
      )
      VALUES (
        order_row.owner_id,
        order_row.season_year,
        'active',
        20,
        p_price_cents,
        lower(p_currency),
        p_session_id,
        p_payment_intent_id,
        nullif(p_customer_id, ''),
        p_price_id,
        now(),
        order_row.id
      )
      RETURNING * INTO entitlement_row;
      previous_entitlement_status := NULL;
    ELSE
      UPDATE public.season_entitlements entitlement
      SET
        status = 'active',
        price_cents = p_price_cents,
        currency = lower(p_currency),
        stripe_checkout_session_id = p_session_id,
        stripe_payment_intent_id = p_payment_intent_id,
        stripe_customer_id = nullif(p_customer_id, ''),
        stripe_price_id = p_price_id,
        source_checkout_order_id = order_row.id,
        purchased_at = now(),
        revoked_at = NULL,
        revocation_reason = NULL,
        revoked_by_event_id = NULL,
        restored_at = CASE
          WHEN entitlement.status IN ('revoked', 'refunded') THEN now()
          ELSE entitlement.restored_at
        END,
        restored_by_event_id = CASE
          WHEN entitlement.status IN ('revoked', 'refunded') THEN p_event_id
          ELSE entitlement.restored_by_event_id
        END,
        updated_at = now()
      WHERE entitlement.id = entitlement_row.id
      RETURNING * INTO entitlement_row;
    END IF;

    UPDATE public.checkout_orders checkout_order
    SET
      entitlement_id = entitlement_row.id,
      status = 'paid',
      stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = p_payment_intent_id,
      stripe_customer_id = nullif(p_customer_id, ''),
      paid_at = coalesce(checkout_order.paid_at, now()),
      last_event_at = now(),
      updated_at = now()
    WHERE checkout_order.id = order_row.id
    RETURNING * INTO order_row;

    SELECT *
      INTO activation_result
    FROM public.gridone_activate_board(
      order_row.contest_id,
      order_row.owner_id,
      order_row.season_year
    );
    is_activated := coalesce(activation_result.activated, false);
    used_count := coalesce(activation_result.used, 0);

    INSERT INTO public.entitlement_audit_events (
      entitlement_id,
      checkout_order_id,
      owner_id,
      season_year,
      stripe_event_id,
      event_type,
      previous_status,
      next_status,
      reason,
      details
    )
    VALUES (
      entitlement_row.id,
      order_row.id,
      order_row.owner_id,
      order_row.season_year,
      p_event_id,
      p_event_type,
      previous_entitlement_status,
      'active',
      CASE
        WHEN previous_entitlement_status IN ('revoked', 'refunded')
          THEN 'repurchase'
        ELSE 'purchase'
      END,
      jsonb_build_object('payment_intent_id', p_payment_intent_id)
    )
    ON CONFLICT (stripe_event_id) DO NOTHING;
    result_outcome := 'fulfilled';
  END IF;

  IF entitlement_row.id IS NOT NULL AND used_count = 0 THEN
    SELECT count(*)::integer
      INTO used_count
    FROM public.board_activations activation
    WHERE activation.entitlement_id = entitlement_row.id;
  END IF;
  IF NOT is_activated THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.board_activations activation
      WHERE activation.contest_id = order_row.contest_id
    ) INTO is_activated;
  END IF;

  UPDATE public.stripe_events stripe_event
  SET outcome = result_outcome
  WHERE stripe_event.event_id = p_event_id;

  RETURN QUERY SELECT
    result_outcome,
    order_row.contest_id,
    order_row.owner_id,
    order_row.season_year,
    entitlement_row.id,
    is_activated,
    used_count,
    coalesce(entitlement_row.boards_allowance::integer, 0),
    order_row.refundable_at IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gridone_apply_entitlement_payment_event(
  p_event_id text,
  p_event_type text,
  p_payment_intent_id text,
  p_charge_id text,
  p_dispute_id text DEFAULT NULL,
  p_dispute_status text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_amount integer DEFAULT NULL,
  p_amount_refunded integer DEFAULT NULL,
  p_refunded boolean DEFAULT false
)
RETURNS TABLE (
  outcome text,
  entitlement_status text,
  order_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  order_row public.checkout_orders%ROWTYPE;
  entitlement_row public.season_entitlements%ROWTYPE;
  prior_outcome text;
  result_outcome text;
  previous_status text;
  next_status text;
  refund_total integer;
  full_refund boolean := false;
  unresolved_dispute boolean := false;
  inserted_count integer;
BEGIN
  SELECT stripe_event.outcome
    INTO prior_outcome
  FROM public.stripe_events stripe_event
  WHERE stripe_event.event_id = p_event_id;

  IF FOUND THEN
    SELECT *
      INTO order_row
    FROM public.checkout_orders checkout_order
    WHERE (
      p_payment_intent_id IS NOT NULL
      AND checkout_order.stripe_payment_intent_id = p_payment_intent_id
    )
    OR (
      p_charge_id IS NOT NULL
      AND checkout_order.stripe_charge_id = p_charge_id
    );
    SELECT entitlement.status
      INTO entitlement_row.status
    FROM public.season_entitlements entitlement
    WHERE entitlement.owner_id = order_row.owner_id
      AND entitlement.season_year = order_row.season_year;
    RETURN QUERY SELECT prior_outcome, entitlement_row.status, order_row.id;
    RETURN;
  END IF;

  SELECT *
    INTO order_row
  FROM public.checkout_orders checkout_order
  WHERE (
    p_payment_intent_id IS NOT NULL
    AND checkout_order.stripe_payment_intent_id = p_payment_intent_id
  )
  OR (
    p_charge_id IS NOT NULL
    AND checkout_order.stripe_charge_id = p_charge_id
  );

  IF NOT FOUND THEN
    INSERT INTO public.stripe_events (
      event_id,
      event_type,
      outcome,
      details
    )
    VALUES (
      p_event_id,
      p_event_type,
      'unmatched_payment',
      jsonb_build_object(
        'payment_intent_id',
        coalesce(p_payment_intent_id, ''),
        'charge_id',
        coalesce(p_charge_id, '')
      )
    )
    ON CONFLICT (event_id) DO NOTHING;
    RETURN QUERY SELECT 'unmatched_payment'::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      order_row.owner_id::text || ':' || order_row.season_year::text,
      0
    )
  );

  SELECT *
    INTO order_row
  FROM public.checkout_orders checkout_order
  WHERE checkout_order.id = order_row.id
  FOR UPDATE;

  result_outcome := 'processing';

  INSERT INTO public.stripe_events (
    event_id,
    event_type,
    checkout_order_id,
    owner_id,
    season_year,
    outcome
  )
  VALUES (
    p_event_id,
    p_event_type,
    order_row.id,
    order_row.owner_id,
    order_row.season_year,
    result_outcome
  )
  ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN
    SELECT stripe_event.outcome
      INTO prior_outcome
    FROM public.stripe_events stripe_event
    WHERE stripe_event.event_id = p_event_id;
    RETURN QUERY SELECT prior_outcome, NULL::text, order_row.id;
    RETURN;
  END IF;

  UPDATE public.checkout_orders checkout_order
  SET
    stripe_charge_id = coalesce(checkout_order.stripe_charge_id, p_charge_id),
    last_event_at = now(),
    updated_at = now()
  WHERE checkout_order.id = order_row.id
  RETURNING * INTO order_row;

  SELECT *
    INTO entitlement_row
  FROM public.season_entitlements entitlement
  WHERE entitlement.owner_id = order_row.owner_id
    AND entitlement.season_year = order_row.season_year
  FOR UPDATE;

  previous_status := entitlement_row.status;
  next_status := entitlement_row.status;

  IF p_event_type = 'charge.refunded' THEN
    refund_total := greatest(
      order_row.amount_refunded_cents,
      coalesce(p_amount_refunded, 0)
    );
    full_refund := p_refunded
      OR refund_total >= coalesce(p_amount, order_row.price_cents);

    UPDATE public.checkout_orders checkout_order
    SET
      amount_refunded_cents = refund_total,
      status = CASE WHEN full_refund THEN 'refunded' ELSE checkout_order.status END,
      terminal_at = CASE
        WHEN full_refund THEN coalesce(checkout_order.terminal_at, now())
        ELSE checkout_order.terminal_at
      END,
      terminal_reason = CASE
        WHEN full_refund THEN 'full_refund'
        ELSE checkout_order.terminal_reason
      END,
      updated_at = now()
    WHERE checkout_order.id = order_row.id
    RETURNING * INTO order_row;

    IF full_refund
      AND entitlement_row.source_checkout_order_id = order_row.id
      AND entitlement_row.status <> 'revoked'
    THEN
      UPDATE public.season_entitlements entitlement
      SET
        status = 'revoked',
        revoked_at = now(),
        revocation_reason = 'full_refund:' || p_charge_id,
        revoked_by_event_id = p_event_id,
        updated_at = now()
      WHERE entitlement.id = entitlement_row.id
      RETURNING * INTO entitlement_row;
      next_status := 'revoked';
      result_outcome := 'entitlement_revoked';
    ELSE
      result_outcome := CASE
        WHEN full_refund THEN 'full_refund_recorded'
        ELSE 'partial_refund_recorded'
      END;
    END IF;
  ELSIF p_event_type = 'charge.dispute.created' THEN
    IF p_dispute_id IS NULL OR p_dispute_status IS NULL THEN
      RAISE EXCEPTION 'Dispute identity and status are required';
    END IF;

    INSERT INTO public.checkout_order_disputes (
      dispute_id,
      checkout_order_id,
      status,
      amount_cents,
      currency,
      opened_event_id
    )
    VALUES (
      p_dispute_id,
      order_row.id,
      p_dispute_status,
      p_amount,
      NULL,
      p_event_id
    )
    ON CONFLICT (dispute_id) DO UPDATE
      SET
        status = EXCLUDED.status,
        amount_cents = coalesce(
          public.checkout_order_disputes.amount_cents,
          EXCLUDED.amount_cents
        ),
        currency = coalesce(
          public.checkout_order_disputes.currency,
          EXCLUDED.currency
        ),
        opened_event_id = coalesce(
          public.checkout_order_disputes.opened_event_id,
          EXCLUDED.opened_event_id
        ),
        updated_at = now();

    UPDATE public.checkout_orders checkout_order
    SET
      status = CASE
        WHEN checkout_order.status = 'refunded' THEN 'refunded'
        ELSE 'disputed'
      END,
      terminal_reason = CASE
        WHEN checkout_order.status = 'refunded' THEN checkout_order.terminal_reason
        ELSE 'dispute_opened'
      END,
      updated_at = now()
    WHERE checkout_order.id = order_row.id
    RETURNING * INTO order_row;

    IF entitlement_row.source_checkout_order_id = order_row.id
      AND entitlement_row.status = 'active'
    THEN
      UPDATE public.season_entitlements entitlement
      SET
        status = 'revoked',
        revoked_at = now(),
        revocation_reason = 'dispute:' || p_dispute_id,
        revoked_by_event_id = p_event_id,
        updated_at = now()
      WHERE entitlement.id = entitlement_row.id
      RETURNING * INTO entitlement_row;
      next_status := 'revoked';
      result_outcome := 'entitlement_revoked';
    ELSE
      result_outcome := 'dispute_recorded';
    END IF;
  ELSIF p_event_type = 'charge.dispute.closed' THEN
    IF p_dispute_id IS NULL OR p_dispute_status IS NULL THEN
      RAISE EXCEPTION 'Dispute identity and status are required';
    END IF;

    INSERT INTO public.checkout_order_disputes (
      dispute_id,
      checkout_order_id,
      status,
      amount_cents,
      currency,
      opened_event_id,
      closed_event_id,
      closed_at
    )
    VALUES (
      p_dispute_id,
      order_row.id,
      p_dispute_status,
      p_amount,
      NULL,
      NULL,
      p_event_id,
      now()
    )
    ON CONFLICT (dispute_id) DO UPDATE
      SET
        status = EXCLUDED.status,
        closed_event_id = coalesce(
          public.checkout_order_disputes.closed_event_id,
          EXCLUDED.closed_event_id
        ),
        closed_at = coalesce(
          public.checkout_order_disputes.closed_at,
          EXCLUDED.closed_at
        ),
        updated_at = now();

    SELECT EXISTS (
      SELECT 1
      FROM public.checkout_order_disputes dispute
      WHERE dispute.checkout_order_id = order_row.id
        AND dispute.status <> 'won'
    ) INTO unresolved_dispute;

    full_refund := order_row.amount_refunded_cents >= order_row.price_cents;

    IF p_dispute_status = 'won' AND NOT full_refund AND NOT unresolved_dispute THEN
      UPDATE public.checkout_orders checkout_order
      SET
        status = CASE
          WHEN checkout_order.duplicate_of_order_id IS NULL THEN 'paid'
          ELSE 'duplicate_paid'
        END,
        terminal_reason = CASE
          WHEN checkout_order.duplicate_of_order_id IS NULL THEN NULL
          ELSE checkout_order.terminal_reason
        END,
        updated_at = now()
      WHERE checkout_order.id = order_row.id
      RETURNING * INTO order_row;

      IF entitlement_row.source_checkout_order_id = order_row.id
        AND entitlement_row.status = 'revoked'
        AND entitlement_row.revocation_reason LIKE 'dispute:%'
      THEN
        UPDATE public.season_entitlements entitlement
        SET
          status = 'active',
          revoked_at = NULL,
          revocation_reason = NULL,
          revoked_by_event_id = NULL,
          restored_at = now(),
          restored_by_event_id = p_event_id,
          updated_at = now()
        WHERE entitlement.id = entitlement_row.id
        RETURNING * INTO entitlement_row;
        next_status := 'active';
        result_outcome := 'entitlement_restored';
      ELSE
        result_outcome := 'dispute_won_recorded';
      END IF;
    ELSE
      result_outcome := CASE
        WHEN p_dispute_status = 'lost' THEN 'dispute_lost_recorded'
        ELSE 'dispute_closed_recorded'
      END;
    END IF;
  ELSE
    result_outcome := 'ignored_unactionable';
  END IF;

  IF entitlement_row.id IS NOT NULL
    AND p_event_type IN (
      'charge.refunded',
      'charge.dispute.created',
      'charge.dispute.closed'
    )
  THEN
    INSERT INTO public.entitlement_audit_events (
      entitlement_id,
      checkout_order_id,
      owner_id,
      season_year,
      stripe_event_id,
      event_type,
      previous_status,
      next_status,
      reason,
      details
    )
    VALUES (
      entitlement_row.id,
      order_row.id,
      order_row.owner_id,
      order_row.season_year,
      p_event_id,
      p_event_type,
      previous_status,
      coalesce(next_status, entitlement_row.status),
      coalesce(nullif(p_reason, ''), result_outcome),
      jsonb_strip_nulls(jsonb_build_object(
        'charge_id', p_charge_id,
        'dispute_id', p_dispute_id,
        'dispute_status', p_dispute_status,
        'amount_cents', p_amount,
        'amount_refunded_cents', p_amount_refunded,
        'refunded', p_refunded
      ))
    )
    ON CONFLICT (stripe_event_id) DO NOTHING;
  END IF;

  UPDATE public.stripe_events stripe_event
  SET outcome = result_outcome
  WHERE stripe_event.event_id = p_event_id;

  RETURN QUERY SELECT result_outcome, entitlement_row.status, order_row.id;
END;
$$;

-- Existing activations are perpetual for their published board. Revocation
-- prevents only a new activation and returns a stable service error.
CREATE OR REPLACE FUNCTION public.gridone_activate_board(
  p_contest_id uuid,
  p_owner_id uuid,
  p_season_year smallint DEFAULT 2026
)
RETURNS TABLE (activated boolean, used integer, allowance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  entitlement public.season_entitlements%ROWTYPE;
  used_count integer;
BEGIN
  SELECT *
    INTO entitlement
  FROM public.season_entitlements entitlement_row
  WHERE entitlement_row.owner_id = p_owner_id
    AND entitlement_row.season_year = p_season_year
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contests contest
    WHERE contest.id = p_contest_id
      AND contest.owner_id = p_owner_id
      AND contest.season_year = p_season_year
  ) THEN
    RAISE EXCEPTION 'Contest is not owned by the entitlement holder';
  END IF;

  SELECT count(*)::integer
    INTO used_count
  FROM public.board_activations activation
  WHERE activation.entitlement_id = entitlement.id;

  IF EXISTS (
    SELECT 1
    FROM public.board_activations activation
    WHERE activation.contest_id = p_contest_id
  ) THEN
    RETURN QUERY SELECT
      true,
      used_count,
      entitlement.boards_allowance::integer;
    RETURN;
  END IF;

  IF entitlement.status <> 'active' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'SEASON_PASS_INACTIVE',
      ERRCODE = 'P0001';
  END IF;

  IF used_count >= entitlement.boards_allowance THEN
    RETURN QUERY SELECT
      false,
      used_count,
      entitlement.boards_allowance::integer;
    RETURN;
  END IF;

  INSERT INTO public.board_activations (entitlement_id, contest_id)
  VALUES (entitlement.id, p_contest_id);

  RETURN QUERY SELECT
    true,
    used_count + 1,
    entitlement.boards_allowance::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_claim_checkout_order(
  uuid,
  uuid,
  smallint,
  text,
  integer,
  text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gridone_attach_checkout_session(
  uuid,
  text,
  timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gridone_record_checkout_session_event(
  text,
  text,
  uuid,
  text,
  text,
  text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gridone_fulfill_checkout_v2(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gridone_apply_entitlement_payment_event(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  boolean
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gridone_activate_board(
  uuid,
  uuid,
  smallint
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gridone_claim_checkout_order(
  uuid,
  uuid,
  smallint,
  text,
  integer,
  text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.gridone_attach_checkout_session(
  uuid,
  text,
  timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.gridone_record_checkout_session_event(
  text,
  text,
  uuid,
  text,
  text,
  text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.gridone_fulfill_checkout_v2(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.gridone_apply_entitlement_payment_event(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  boolean
) TO service_role;
GRANT EXECUTE ON FUNCTION public.gridone_activate_board(
  uuid,
  uuid,
  smallint
) TO service_role;
