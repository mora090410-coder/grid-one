-- Tiered 2026 pricing and publish-time allowance enforcement.
--
-- Draft creation, editing, and preview remain free. An allowance is consumed
-- only inside gridone_publish_board, in the same transaction that publishes the
-- immutable viewer snapshot.

ALTER TABLE public.season_entitlements
  ADD COLUMN tier text NOT NULL DEFAULT 'legacy',
  ADD COLUMN organization_display_name text;

ALTER TABLE public.season_entitlements
  ADD CONSTRAINT season_entitlements_tier_check
    CHECK (tier IN ('free', 'gameday', 'org', 'legacy')),
  ADD CONSTRAINT season_entitlements_organization_name_check
    CHECK (
      organization_display_name IS NULL
      OR char_length(btrim(organization_display_name)) BETWEEN 1 AND 120
    ),
  ADD CONSTRAINT season_entitlements_org_name_required_check
    CHECK (
      tier <> 'org'
      OR (
        organization_display_name IS NOT NULL
        AND char_length(btrim(organization_display_name)) BETWEEN 1 AND 120
      )
    );

ALTER TABLE public.checkout_orders
  ADD COLUMN target_tier text,
  ADD COLUMN organization_display_name text;

ALTER TABLE public.checkout_orders
  ADD CONSTRAINT checkout_orders_target_tier_check
    CHECK (target_tier IS NULL OR target_tier IN ('gameday', 'org')),
  ADD CONSTRAINT checkout_orders_organization_name_check
    CHECK (
      organization_display_name IS NULL
      OR char_length(btrim(organization_display_name)) BETWEEN 1 AND 120
    ),
  ADD CONSTRAINT checkout_orders_org_name_required_check
    CHECK (
      target_tier IS DISTINCT FROM 'org'
      OR (
        organization_display_name IS NOT NULL
        AND char_length(btrim(organization_display_name)) BETWEEN 1 AND 120
      )
    );

ALTER TABLE public.public_board_snapshots
  ADD COLUMN organization_display_name text;

ALTER TABLE public.public_board_snapshots
  ADD CONSTRAINT public_board_snapshots_organization_name_check
    CHECK (
      organization_display_name IS NULL
      OR char_length(btrim(organization_display_name)) BETWEEN 1 AND 120
    );

-- Every pre-tier entitlement is the retired offer. Preserve every activation,
-- but reduce its allowance to exactly the amount already consumed (with the
-- existing minimum-one schema invariant).
UPDATE public.season_entitlements entitlement
SET
  tier = 'legacy',
  boards_allowance = greatest(
    (
      SELECT count(*)::integer
      FROM public.board_activations activation
      WHERE activation.entitlement_id = entitlement.id
    ),
    1
  )::smallint,
  organization_display_name = NULL,
  updated_at = now();

-- The retired fulfillment entry point must never recreate the old 20-board
-- offer, even if stale service code calls it.
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
RETURNS TABLE (
  contest_id uuid,
  owner_id uuid,
  activated boolean,
  used integer,
  allowance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION USING
    MESSAGE = 'LEGACY_CHECKOUT_FULFILLMENT_DISABLED',
    ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_fulfill_checkout(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text
) FROM PUBLIC, anon, authenticated, service_role;

-- Publishing now validates the complete board before taking the owner-season
-- lock or consuming allowance. The input signature remains unchanged.
DROP FUNCTION public.gridone_publish_board(
  uuid,
  uuid,
  bigint,
  smallint[],
  smallint[],
  jsonb,
  jsonb,
  jsonb
);

CREATE FUNCTION public.gridone_publish_board(
  p_contest_id uuid,
  p_owner_id uuid,
  p_expected_revision bigint,
  p_side_axis smallint[],
  p_top_axis smallint[],
  p_normalized_names jsonb,
  p_public_board jsonb,
  p_matchup jsonb
)
RETURNS TABLE (
  published boolean,
  share_code text,
  next_revision bigint,
  published_at timestamptz,
  tier text,
  used integer,
  allowance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_contest public.contests%ROWTYPE;
  updated_contest public.contests%ROWTYPE;
  entitlement_row public.season_entitlements%ROWTYPE;
  publish_time timestamptz;
  used_count integer := 0;
  already_activated boolean := false;
BEGIN
  SELECT *
    INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
    AND contest.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND OR current_contest.revision <> p_expected_revision THEN
    RETURN;
  END IF;

  IF current_contest.game_external_id IS NULL THEN
    RAISE EXCEPTION 'Link a scheduled NFL game before publishing';
  END IF;

  IF cardinality(p_side_axis) IS DISTINCT FROM 10
    OR cardinality(p_top_axis) IS DISTINCT FROM 10
    OR NOT (
      p_side_axis <@ ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[]
      AND ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[] <@ p_side_axis
      AND p_top_axis <@ ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[]
      AND ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[] <@ p_top_axis
    )
  THEN
    RAISE EXCEPTION 'Draw all ten unique axis digits before publishing';
  END IF;

  IF jsonb_typeof(p_normalized_names) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_normalized_names) <> 100
  THEN
    RAISE EXCEPTION 'The board must contain exactly 100 squares';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_normalized_names) cell(value)
    WHERE jsonb_typeof(cell.value) IS DISTINCT FROM 'array'
      OR jsonb_array_length(cell.value) <> 1
      OR jsonb_typeof(cell.value -> 0) IS DISTINCT FROM 'string'
      OR char_length(btrim(cell.value ->> 0)) NOT BETWEEN 1 AND 80
  ) THEN
    RAISE EXCEPTION 'Every square must contain exactly one purchaser name';
  END IF;

  IF jsonb_typeof(p_public_board) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_matchup) IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'Published board and matchup payloads must be objects';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_owner_id::text || ':' || current_contest.season_year::text,
      0
    )
  );

  INSERT INTO public.season_entitlements (
    owner_id,
    season_year,
    status,
    tier,
    boards_allowance,
    price_cents,
    currency
  )
  VALUES (
    p_owner_id,
    current_contest.season_year,
    'active',
    'free',
    1,
    0,
    'usd'
  )
  ON CONFLICT (owner_id, season_year) DO NOTHING;

  SELECT *
    INTO entitlement_row
  FROM public.season_entitlements entitlement
  WHERE entitlement.owner_id = p_owner_id
    AND entitlement.season_year = current_contest.season_year
  FOR UPDATE;

  SELECT count(*)::integer
    INTO used_count
  FROM public.board_activations activation
  WHERE activation.entitlement_id = entitlement_row.id;

  SELECT EXISTS (
    SELECT 1
    FROM public.board_activations activation
    WHERE activation.contest_id = current_contest.id
  ) INTO already_activated;

  IF NOT already_activated THEN
    IF entitlement_row.status <> 'active' THEN
      RAISE EXCEPTION USING
        MESSAGE = format(
          'PUBLISH_ENTITLEMENT_INACTIVE:%s:%s:%s',
          entitlement_row.tier,
          used_count,
          entitlement_row.boards_allowance
        ),
        ERRCODE = 'P0001';
    END IF;

    IF used_count >= entitlement_row.boards_allowance THEN
      RAISE EXCEPTION USING
        MESSAGE = format(
          'PUBLISH_ALLOWANCE_EXHAUSTED:%s:%s:%s',
          entitlement_row.tier,
          used_count,
          entitlement_row.boards_allowance
        ),
        ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.board_activations (entitlement_id, contest_id)
    VALUES (entitlement_row.id, current_contest.id);
    used_count := used_count + 1;
  END IF;

  publish_time := coalesce(current_contest.published_at, now());

  UPDATE public.contests contest
  SET
    status = 'published',
    side_axis = p_side_axis,
    top_axis = p_top_axis,
    axis_locked_at = coalesce(contest.axis_locked_at, publish_time),
    axis_locked_by = coalesce(contest.axis_locked_by, p_owner_id),
    published_at = publish_time
  WHERE contest.id = current_contest.id
    AND contest.revision = p_expected_revision
  RETURNING contest.* INTO updated_contest;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.contest_participants (
    contest_id,
    display_name,
    public_label
  )
  SELECT DISTINCT
    current_contest.id,
    cell.value ->> 0,
    public.gridone_public_participant_label(cell.value ->> 0)
  FROM jsonb_array_elements(p_normalized_names) AS cell(value)
  ON CONFLICT (contest_id, display_name) DO UPDATE
    SET public_label = EXCLUDED.public_label,
        updated_at = now();

  INSERT INTO public.square_assignments (
    contest_id,
    cell_index,
    participant_id
  )
  SELECT
    current_contest.id,
    (cell.ordinality - 1)::smallint,
    participant.id
  FROM jsonb_array_elements(p_normalized_names) WITH ORDINALITY AS cell(value, ordinality)
  JOIN public.contest_participants participant
    ON participant.contest_id = current_contest.id
   AND participant.display_name = cell.value ->> 0
  ON CONFLICT (contest_id, cell_index) DO UPDATE
    SET participant_id = EXCLUDED.participant_id,
        updated_at = now();

  INSERT INTO public.public_board_snapshots (
    contest_id,
    share_code,
    revision,
    board_title,
    matchup,
    board,
    payout_labels,
    organization_display_name,
    published_at,
    updated_at,
    withdrawn_at
  )
  VALUES (
    current_contest.id,
    current_contest.share_code,
    updated_contest.revision,
    updated_contest.title,
    p_matchup,
    p_public_board || jsonb_build_object(
      'participants',
      (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', participant.id,
              'displayName', participant.display_name,
              'publicLabel', participant.public_label
            )
            ORDER BY participant.display_name
          ),
          '[]'::jsonb
        )
        FROM public.contest_participants participant
        WHERE participant.contest_id = current_contest.id
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_normalized_names) cell(value)
            WHERE cell.value ->> 0 = participant.display_name
          )
      )
    ),
    updated_contest.payout_labels,
    CASE
      WHEN entitlement_row.tier = 'org'
        THEN entitlement_row.organization_display_name
      ELSE NULL
    END,
    publish_time,
    now(),
    NULL
  )
  ON CONFLICT (contest_id) DO UPDATE
    SET revision = EXCLUDED.revision,
        board_title = EXCLUDED.board_title,
        matchup = EXCLUDED.matchup,
        board = EXCLUDED.board,
        payout_labels = EXCLUDED.payout_labels,
        organization_display_name = EXCLUDED.organization_display_name,
        published_at = EXCLUDED.published_at,
        updated_at = EXCLUDED.updated_at,
        withdrawn_at = NULL;

  INSERT INTO public.contest_audit_events (
    contest_id,
    actor_id,
    event_type,
    previous_revision,
    next_revision,
    details
  )
  VALUES (
    current_contest.id,
    p_owner_id,
    CASE WHEN current_contest.published_at IS NULL
      THEN 'board.published'
      ELSE 'board.republished'
    END,
    current_contest.revision,
    updated_contest.revision,
    jsonb_build_object(
      'share_code', current_contest.share_code,
      'tier', entitlement_row.tier,
      'used', used_count,
      'allowance', entitlement_row.boards_allowance
    )
  );

  RETURN QUERY SELECT
    true,
    updated_contest.share_code,
    updated_contest.revision,
    publish_time,
    entitlement_row.tier,
    used_count,
    entitlement_row.boards_allowance::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_publish_board(
  uuid,
  uuid,
  bigint,
  smallint[],
  smallint[],
  jsonb,
  jsonb,
  jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_publish_board(
  uuid,
  uuid,
  bigint,
  smallint[],
  smallint[],
  jsonb,
  jsonb,
  jsonb
) TO service_role;

-- The legacy activation RPC remains callable for compatibility, but it is now
-- read-only. Only gridone_publish_board may create a board activation.
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
  entitlement_row public.season_entitlements%ROWTYPE;
  used_count integer := 0;
  is_activated boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.contests contest
    WHERE contest.id = p_contest_id
      AND contest.owner_id = p_owner_id
      AND contest.season_year = p_season_year
  ) THEN
    RAISE EXCEPTION 'Contest is not owned by the entitlement holder';
  END IF;

  SELECT *
    INTO entitlement_row
  FROM public.season_entitlements entitlement
  WHERE entitlement.owner_id = p_owner_id
    AND entitlement.season_year = p_season_year;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  SELECT count(*)::integer
    INTO used_count
  FROM public.board_activations activation
  WHERE activation.entitlement_id = entitlement_row.id;

  SELECT EXISTS (
    SELECT 1
    FROM public.board_activations activation
    WHERE activation.contest_id = p_contest_id
  ) INTO is_activated;

  RETURN QUERY SELECT
    is_activated,
    used_count,
    entitlement_row.boards_allowance::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_activate_board(
  uuid,
  uuid,
  smallint
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_activate_board(
  uuid,
  uuid,
  smallint
) TO service_role;

-- Paid checkout is available only for an upward tier transition, or for a
-- same/higher-tier repurchase after revocation/refund.
DROP FUNCTION public.gridone_claim_checkout_order(
  uuid,
  uuid,
  smallint,
  text,
  integer,
  text
);

CREATE FUNCTION public.gridone_claim_checkout_order(
  p_owner_id uuid,
  p_contest_id uuid,
  p_season_year smallint,
  p_price_id text,
  p_price_cents integer,
  p_currency text,
  p_target_tier text,
  p_organization_display_name text DEFAULT NULL
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
  target_rank integer;
  current_rank integer := 0;
  normalized_organization_name text;
BEGIN
  IF p_price_cents < 0 OR lower(p_currency) !~ '^[a-z]{3}$' THEN
    RAISE EXCEPTION 'Invalid checkout price';
  END IF;

  IF p_target_tier IS NULL OR p_target_tier NOT IN ('gameday', 'org') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'CHECKOUT_TARGET_TIER_INVALID',
      ERRCODE = 'P0001';
  END IF;

  normalized_organization_name := nullif(btrim(p_organization_display_name), '');
  IF p_target_tier = 'org'
    AND (
      normalized_organization_name IS NULL
      OR char_length(normalized_organization_name) > 120
    )
  THEN
    RAISE EXCEPTION USING
      MESSAGE = 'CHECKOUT_ORGANIZATION_NAME_REQUIRED',
      ERRCODE = 'P0001';
  END IF;
  IF p_target_tier = 'gameday' THEN
    normalized_organization_name := NULL;
  END IF;

  target_rank := CASE p_target_tier
    WHEN 'gameday' THEN 2
    WHEN 'org' THEN 3
  END;

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

  IF FOUND THEN
    current_rank := CASE entitlement_row.tier
      WHEN 'free' THEN 1
      WHEN 'gameday' THEN 2
      WHEN 'org' THEN 3
      ELSE 0
    END;

    IF entitlement_row.status = 'active' AND target_rank <= current_rank THEN
      RETURN QUERY SELECT
        NULL::uuid,
        NULL::text,
        NULL::text,
        entitlement_row.status,
        true;
      RETURN;
    END IF;

    IF entitlement_row.status <> 'active' AND target_rank < current_rank THEN
      RAISE EXCEPTION USING
        MESSAGE = 'CHECKOUT_DOWNGRADE_NOT_ALLOWED',
        ERRCODE = 'P0001';
    END IF;
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
    IF order_row.target_tier IS DISTINCT FROM p_target_tier
      OR (
        p_target_tier = 'org'
        AND order_row.organization_display_name
          IS DISTINCT FROM normalized_organization_name
      )
    THEN
      RAISE EXCEPTION USING
        MESSAGE = 'CHECKOUT_TARGET_CONFLICT:' || coalesce(order_row.target_tier, 'legacy'),
        ERRCODE = 'P0001';
    END IF;

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
    currency,
    target_tier,
    organization_display_name
  )
  VALUES (
    p_owner_id,
    p_contest_id,
    p_season_year,
    p_price_id,
    p_price_cents,
    lower(p_currency),
    p_target_tier,
    normalized_organization_name
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

REVOKE ALL ON FUNCTION public.gridone_claim_checkout_order(
  uuid,
  uuid,
  smallint,
  text,
  integer,
  text,
  text,
  text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_claim_checkout_order(
  uuid,
  uuid,
  smallint,
  text,
  integer,
  text,
  text,
  text
) TO service_role;

-- Fulfillment upgrades or restores the one stable owner-season entitlement.
-- It never activates a board; capacity is consumed only by publication.
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
  prior_outcome text;
  result_outcome text;
  previous_entitlement_status text;
  previous_tier text;
  used_count integer := 0;
  is_activated boolean := false;
  is_same_source boolean := false;
  inserted_count integer;
  current_rank integer := 0;
  target_rank integer;
  target_allowance integer;
  can_fulfill boolean := false;
BEGIN
  SELECT *
    INTO order_row
  FROM public.checkout_orders checkout_order
  WHERE checkout_order.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout order not found';
  END IF;

  IF order_row.target_tier IS NULL
    OR order_row.target_tier NOT IN ('gameday', 'org')
  THEN
    RAISE EXCEPTION USING
      MESSAGE = 'CHECKOUT_TARGET_TIER_MISSING',
      ERRCODE = 'P0001';
  END IF;

  target_rank := CASE order_row.target_tier
    WHEN 'gameday' THEN 2
    WHEN 'org' THEN 3
  END;
  target_allowance := CASE order_row.target_tier
    WHEN 'gameday' THEN 5
    WHEN 'org' THEN 50
  END;

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
    previous_tier := entitlement_row.tier;
    current_rank := CASE entitlement_row.tier
      WHEN 'free' THEN 1
      WHEN 'gameday' THEN 2
      WHEN 'org' THEN 3
      ELSE 0
    END;
    is_same_source := entitlement_row.source_checkout_order_id = order_row.id
      OR (
        entitlement_row.source_checkout_order_id IS NULL
        AND (
          entitlement_row.stripe_checkout_session_id = p_session_id
          OR entitlement_row.stripe_payment_intent_id = p_payment_intent_id
        )
      );
    can_fulfill := (
      entitlement_row.status = 'active'
      AND target_rank > current_rank
    ) OR (
      entitlement_row.status <> 'active'
      AND target_rank >= current_rank
    );
  ELSE
    can_fulfill := true;
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
    result_outcome := 'already_fulfilled';
  ELSIF NOT can_fulfill THEN
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
        tier,
        boards_allowance,
        organization_display_name,
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
        order_row.target_tier,
        target_allowance,
        CASE
          WHEN order_row.target_tier = 'org'
            THEN btrim(order_row.organization_display_name)
          ELSE NULL
        END,
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
      previous_tier := NULL;
    ELSE
      UPDATE public.season_entitlements entitlement
      SET
        status = 'active',
        tier = order_row.target_tier,
        boards_allowance = target_allowance,
        organization_display_name = CASE
          WHEN order_row.target_tier = 'org'
            THEN btrim(order_row.organization_display_name)
          ELSE NULL
        END,
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

    IF entitlement_row.tier = 'org' THEN
      UPDATE public.public_board_snapshots snapshot
      SET
        organization_display_name = entitlement_row.organization_display_name,
        updated_at = now()
      FROM public.contests contest
      WHERE snapshot.contest_id = contest.id
        AND contest.owner_id = order_row.owner_id
        AND contest.season_year = order_row.season_year;
    END IF;

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
        WHEN previous_tier IS NOT NULL
          THEN 'upgrade'
        ELSE 'purchase'
      END,
      jsonb_strip_nulls(jsonb_build_object(
        'payment_intent_id', p_payment_intent_id,
        'previous_tier', previous_tier,
        'next_tier', entitlement_row.tier,
        'allowance', entitlement_row.boards_allowance
      ))
    )
    ON CONFLICT (stripe_event_id) DO NOTHING;
    result_outcome := 'fulfilled';
  END IF;

  IF entitlement_row.id IS NOT NULL THEN
    SELECT count(*)::integer
      INTO used_count
    FROM public.board_activations activation
    WHERE activation.entitlement_id = entitlement_row.id;
  END IF;
  SELECT EXISTS (
    SELECT 1
    FROM public.board_activations activation
    WHERE activation.contest_id = order_row.contest_id
  ) INTO is_activated;

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
