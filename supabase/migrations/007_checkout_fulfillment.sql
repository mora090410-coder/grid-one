-- Transactional Stripe order and webhook fulfillment.

CREATE TABLE public.checkout_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  season_year smallint NOT NULL DEFAULT 2026,
  price_id text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'checkout_created', 'paid', 'failed', 'expired')),
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE UNIQUE INDEX checkout_orders_one_open_key
  ON public.checkout_orders (owner_id, contest_id, season_year)
  WHERE status IN ('pending', 'checkout_created');

CREATE TABLE public.stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  checkout_order_id uuid REFERENCES public.checkout_orders(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizer can read own checkout orders"
  ON public.checkout_orders FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.checkout_orders FROM anon;
REVOKE ALL ON TABLE public.stripe_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.checkout_orders TO authenticated;
GRANT ALL ON TABLE public.checkout_orders, public.stripe_events TO service_role;

CREATE OR REPLACE FUNCTION public.gridone_fulfill_checkout(
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
RETURNS TABLE (contest_id uuid, owner_id uuid, activated boolean, used integer, allowance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  order_row public.checkout_orders%ROWTYPE;
  entitlement_id uuid;
  activation_result record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.stripe_events WHERE event_id = p_event_id) THEN
    SELECT o.contest_id, o.owner_id
      INTO order_row.contest_id, order_row.owner_id
    FROM public.checkout_orders o WHERE o.id = p_order_id;
    SELECT * INTO activation_result
    FROM public.gridone_activate_board(order_row.contest_id, order_row.owner_id, 2026);
    RETURN QUERY SELECT order_row.contest_id, order_row.owner_id,
      activation_result.activated, activation_result.used, activation_result.allowance;
    RETURN;
  END IF;

  SELECT * INTO order_row
  FROM public.checkout_orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout order not found'; END IF;
  IF order_row.price_id <> p_price_id
    OR order_row.price_cents <> p_price_cents
    OR order_row.currency <> lower(p_currency)
  THEN
    RAISE EXCEPTION 'Checkout price does not match the order';
  END IF;

  INSERT INTO public.stripe_events (event_id, event_type, checkout_order_id)
  VALUES (p_event_id, p_event_type, order_row.id);

  UPDATE public.checkout_orders
    SET status = 'paid',
        stripe_checkout_session_id = p_session_id,
        stripe_payment_intent_id = p_payment_intent_id,
        paid_at = COALESCE(paid_at, now()),
        updated_at = now()
  WHERE id = order_row.id;

  INSERT INTO public.season_entitlements (
    owner_id, season_year, status, boards_allowance, price_cents, currency,
    stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id,
    stripe_price_id, purchased_at
  )
  VALUES (
    order_row.owner_id, order_row.season_year, 'active', 20, p_price_cents,
    lower(p_currency), p_session_id, p_payment_intent_id, p_customer_id,
    p_price_id, now()
  )
  ON CONFLICT (owner_id, season_year) DO UPDATE
    SET status = 'active',
        updated_at = now(),
        purchased_at = COALESCE(public.season_entitlements.purchased_at, EXCLUDED.purchased_at)
  RETURNING id INTO entitlement_id;

  SELECT * INTO activation_result
  FROM public.gridone_activate_board(order_row.contest_id, order_row.owner_id, order_row.season_year);

  IF NOT activation_result.activated THEN
    RAISE EXCEPTION 'Entitlement could not activate this board';
  END IF;

  RETURN QUERY SELECT order_row.contest_id, order_row.owner_id,
    activation_result.activated, activation_result.used, activation_result.allowance;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_fulfill_checkout(text, text, uuid, text, text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gridone_fulfill_checkout(text, text, uuid, text, text, text, text, integer, text) TO service_role;
