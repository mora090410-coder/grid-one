-- Allow intentionally incomplete boards to publish while preserving immutable
-- occupied cells, deterministic open-square results, and a hard kickoff freeze.

ALTER TABLE public.contests
  ADD COLUMN allow_open_squares boolean NOT NULL DEFAULT false;

ALTER TABLE public.milestone_resolutions
  ADD COLUMN open_square boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT milestone_resolutions_open_square_shape
    CHECK (NOT open_square OR (assignment_id IS NULL AND participant_id IS NULL));

-- Replace the eight-argument publish function with a backward-compatible
-- trailing default. The owner must opt in explicitly whenever any cells remain
-- open, and the decision is persisted on the contest and in the audit event.
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
  p_matchup jsonb,
  p_allow_open_squares boolean DEFAULT false
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
  open_square_count integer := 0;
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
      OR jsonb_array_length(cell.value) > 1
      OR (
        jsonb_array_length(cell.value) = 1
        AND (
          jsonb_typeof(cell.value -> 0) IS DISTINCT FROM 'string'
          OR char_length(btrim(cell.value ->> 0)) NOT BETWEEN 1 AND 80
          OR cell.value ->> 0 <> btrim(cell.value ->> 0)
        )
      )
  ) THEN
    RAISE EXCEPTION 'Every square must be open or contain exactly one purchaser name';
  END IF;

  SELECT count(*)::integer
    INTO open_square_count
  FROM jsonb_array_elements(p_normalized_names) cell(value)
  WHERE jsonb_array_length(cell.value) = 0;

  IF open_square_count = 100 THEN
    RAISE EXCEPTION 'Assign at least one square before publishing';
  END IF;

  IF open_square_count > 0 AND NOT p_allow_open_squares THEN
    RAISE EXCEPTION
      '% squares are still open. Confirm open-square publication before publishing',
      open_square_count;
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
    published_at = publish_time,
    allow_open_squares = p_allow_open_squares
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
  WHERE jsonb_array_length(cell.value) = 1
  ON CONFLICT ON CONSTRAINT contest_participants_name_key DO UPDATE
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
  WHERE jsonb_array_length(cell.value) = 1
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
      'allowOpenSquares', p_allow_open_squares,
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
      'allowance', entitlement_row.boards_allowance,
      'allowOpenSquares', p_allow_open_squares,
      'openSquareCount', open_square_count
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
  jsonb,
  boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_publish_board(
  uuid,
  uuid,
  bigint,
  smallint[],
  smallint[],
  jsonb,
  jsonb,
  jsonb,
  boolean
) TO service_role;

-- Open-square state is explicit in every immutable resolution version and in
-- the viewer-safe winner-history projection.
CREATE OR REPLACE FUNCTION public.gridone_project_milestones(p_contest_id uuid)
RETURNS TABLE (
  winner_history jsonb,
  pending_milestones jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  projected_history jsonb;
  projected_pending jsonb;
BEGIN
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'milestone', pending.milestone,
        'status', 'pending',
        'sideScore', pending.candidate_side_score,
        'topScore', pending.candidate_top_score,
        'sideDigit', pending.candidate_side_score % 10,
        'topDigit', pending.candidate_top_score % 10,
        'stableSince', pending.stable_since,
        'lastObservedAt', pending.last_observed_at
      )
      ORDER BY CASE pending.milestone
        WHEN 'Q1' THEN 1 WHEN 'Q2' THEN 2 WHEN 'Q3' THEN 3 ELSE 4
      END
    ),
    '[]'::jsonb
  )
  INTO projected_pending
  FROM public.pending_resolutions pending
  WHERE pending.contest_id = p_contest_id;

  WITH ranked AS (
    SELECT
      resolution.*,
      participant.display_name AS participant_name,
      row_number() OVER (
        PARTITION BY resolution.milestone
        ORDER BY resolution.resolution_version DESC
      ) AS current_rank
    FROM public.milestone_resolutions resolution
    LEFT JOIN public.contest_participants participant
      ON participant.id = resolution.participant_id
    WHERE resolution.contest_id = p_contest_id
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'milestone', current_resolution.milestone,
        'sideDigit', current_resolution.side_digit,
        'topDigit', current_resolution.top_digit,
        'sideScore', current_resolution.side_score,
        'topScore', current_resolution.top_score,
        'participantName', current_resolution.participant_name,
        'openSquare', current_resolution.open_square,
        'resolvedAt', current_resolution.resolved_at,
        'resolutionVersion', current_resolution.resolution_version,
        'corrected', current_resolution.resolution_version > 1,
        'correctedAt', current_resolution.corrected_at,
        'correctionReason', current_resolution.correction_reason,
        'versions', (
          SELECT coalesce(
            jsonb_agg(
              jsonb_build_object(
                'resolutionVersion', version.resolution_version,
                'sideDigit', version.side_digit,
                'topDigit', version.top_digit,
                'sideScore', version.side_score,
                'topScore', version.top_score,
                'participantName', version_participant.display_name,
                'openSquare', version.open_square,
                'resolvedAt', version.resolved_at,
                'correctedAt', version.corrected_at,
                'correctionReason', version.correction_reason,
                'isCurrent',
                  version.resolution_version = current_resolution.resolution_version
              )
              ORDER BY version.resolution_version
            ),
            '[]'::jsonb
          )
          FROM public.milestone_resolutions version
          LEFT JOIN public.contest_participants version_participant
            ON version_participant.id = version.participant_id
          WHERE version.contest_id = p_contest_id
            AND version.milestone = current_resolution.milestone
        )
      )
      ORDER BY CASE current_resolution.milestone
        WHEN 'Q1' THEN 1 WHEN 'Q2' THEN 2 WHEN 'Q3' THEN 3 ELSE 4
      END
    ),
    '[]'::jsonb
  )
  INTO projected_history
  FROM ranked current_resolution
  WHERE current_resolution.current_rank = 1;

  UPDATE public.public_board_snapshots snapshot
  SET
    winner_history = projected_history,
    pending_milestones = projected_pending,
    updated_at = clock_timestamp()
  WHERE snapshot.contest_id = p_contest_id
    AND (
      snapshot.winner_history IS DISTINCT FROM projected_history
      OR snapshot.pending_milestones IS DISTINCT FROM projected_pending
    );

  RETURN QUERY SELECT projected_history, projected_pending;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_project_milestones(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_project_milestones(uuid) TO service_role;

-- Migration 017 made the unchecked observer private behind the idempotent
-- public wrapper. Replace that private implementation, not the wrapper.
CREATE OR REPLACE FUNCTION public.gridone_observe_milestones_unchecked(
  p_contest_id uuid,
  p_snapshot_id uuid
)
RETURNS TABLE (
  winner_history jsonb,
  pending_milestones jsonb,
  newly_confirmed_resolution_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  observed_snapshot public.score_snapshots%ROWTYPE;
  current_contest public.contests%ROWTYPE;
  current_pending public.pending_resolutions%ROWTYPE;
  milestone_name text;
  candidate_side integer;
  candidate_top integer;
  milestone_eligible boolean;
  should_confirm boolean;
  winner_assignment public.square_assignments%ROWTYPE;
  new_resolution_id uuid;
  projected_history jsonb;
  projected_pending jsonb;
  confirmed_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT contest.*
  INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found';
  END IF;

  SELECT snapshot.*
  INTO observed_snapshot
  FROM public.score_snapshots snapshot
  JOIN public.contest_score_state state
    ON state.contest_id = snapshot.contest_id
   AND state.current_snapshot_id = snapshot.id
  WHERE snapshot.id = p_snapshot_id
    AND snapshot.contest_id = p_contest_id
    AND snapshot.validation_status = 'accepted'
    AND snapshot.is_current;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone observation requires the current accepted snapshot';
  END IF;

  FOREACH milestone_name IN ARRAY ARRAY['Q1', 'Q2', 'Q3', 'FINAL']
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_contest_id::text || ':' || milestone_name, 0)
    );

    IF EXISTS (
      SELECT 1
      FROM public.milestone_resolutions resolution
      WHERE resolution.contest_id = p_contest_id
        AND resolution.milestone = milestone_name
    ) THEN
      DELETE FROM public.pending_resolutions pending
      WHERE pending.contest_id = p_contest_id
        AND pending.milestone = milestone_name;
      CONTINUE;
    END IF;

    milestone_eligible := CASE milestone_name
      WHEN 'Q1' THEN observed_snapshot.period > 1 OR observed_snapshot.game_state = 'post'
      WHEN 'Q2' THEN observed_snapshot.period > 2 OR observed_snapshot.game_state = 'post'
      WHEN 'Q3' THEN observed_snapshot.period > 3 OR observed_snapshot.game_state = 'post'
      ELSE observed_snapshot.game_state = 'post'
    END;

    IF NOT milestone_eligible THEN
      DELETE FROM public.pending_resolutions pending
      WHERE pending.contest_id = p_contest_id
        AND pending.milestone = milestone_name;
      CONTINUE;
    END IF;

    candidate_side := CASE milestone_name
      WHEN 'Q1' THEN coalesce((observed_snapshot.quarter_scores -> 'Q1' ->> 'left')::integer, 0)
      WHEN 'Q2' THEN
        coalesce((observed_snapshot.quarter_scores -> 'Q1' ->> 'left')::integer, 0)
        + coalesce((observed_snapshot.quarter_scores -> 'Q2' ->> 'left')::integer, 0)
      WHEN 'Q3' THEN
        coalesce((observed_snapshot.quarter_scores -> 'Q1' ->> 'left')::integer, 0)
        + coalesce((observed_snapshot.quarter_scores -> 'Q2' ->> 'left')::integer, 0)
        + coalesce((observed_snapshot.quarter_scores -> 'Q3' ->> 'left')::integer, 0)
      ELSE observed_snapshot.side_score
    END;
    candidate_top := CASE milestone_name
      WHEN 'Q1' THEN coalesce((observed_snapshot.quarter_scores -> 'Q1' ->> 'top')::integer, 0)
      WHEN 'Q2' THEN
        coalesce((observed_snapshot.quarter_scores -> 'Q1' ->> 'top')::integer, 0)
        + coalesce((observed_snapshot.quarter_scores -> 'Q2' ->> 'top')::integer, 0)
      WHEN 'Q3' THEN
        coalesce((observed_snapshot.quarter_scores -> 'Q1' ->> 'top')::integer, 0)
        + coalesce((observed_snapshot.quarter_scores -> 'Q2' ->> 'top')::integer, 0)
        + coalesce((observed_snapshot.quarter_scores -> 'Q3' ->> 'top')::integer, 0)
      ELSE observed_snapshot.top_score
    END;

    IF candidate_side NOT BETWEEN 0 AND 255 OR candidate_top NOT BETWEEN 0 AND 255 THEN
      RAISE EXCEPTION 'Milestone score is outside the supported range';
    END IF;

    should_confirm :=
      observed_snapshot.source_mode = 'manual'
      OR (milestone_name = 'FINAL' AND observed_snapshot.game_state = 'post');

    IF NOT should_confirm THEN
      SELECT pending.*
      INTO current_pending
      FROM public.pending_resolutions pending
      WHERE pending.contest_id = p_contest_id
        AND pending.milestone = milestone_name
      FOR UPDATE;

      IF NOT FOUND
        OR current_pending.candidate_side_score <> candidate_side
        OR current_pending.candidate_top_score <> candidate_top
      THEN
        INSERT INTO public.pending_resolutions (
          contest_id,
          milestone,
          candidate_side_score,
          candidate_top_score,
          first_snapshot_id,
          latest_snapshot_id,
          stable_since,
          last_observed_at,
          successful_read_count
        )
        VALUES (
          p_contest_id,
          milestone_name,
          candidate_side,
          candidate_top,
          p_snapshot_id,
          p_snapshot_id,
          observed_snapshot.retrieved_at,
          observed_snapshot.retrieved_at,
          1
        )
        ON CONFLICT (contest_id, milestone) DO UPDATE
        SET
          candidate_side_score = EXCLUDED.candidate_side_score,
          candidate_top_score = EXCLUDED.candidate_top_score,
          first_snapshot_id = EXCLUDED.first_snapshot_id,
          latest_snapshot_id = EXCLUDED.latest_snapshot_id,
          stable_since = EXCLUDED.stable_since,
          last_observed_at = EXCLUDED.last_observed_at,
          successful_read_count = 1;
        CONTINUE;
      END IF;

      IF current_pending.latest_snapshot_id = p_snapshot_id THEN
        CONTINUE;
      END IF;

      UPDATE public.pending_resolutions pending
      SET
        latest_snapshot_id = p_snapshot_id,
        last_observed_at = greatest(
          pending.last_observed_at,
          observed_snapshot.retrieved_at
        ),
        successful_read_count = pending.successful_read_count + 1
      WHERE pending.contest_id = p_contest_id
        AND pending.milestone = milestone_name;

      should_confirm :=
        observed_snapshot.retrieved_at >= current_pending.stable_since + interval '45 seconds';
      IF NOT should_confirm THEN
        CONTINUE;
      END IF;
    END IF;

    winner_assignment := NULL;
    SELECT assignment.*
    INTO winner_assignment
    FROM public.square_assignments assignment
    WHERE assignment.contest_id = p_contest_id
      AND assignment.cell_index = (
        (array_position(current_contest.side_axis, (candidate_side % 10)::smallint) - 1) * 10
        + array_position(current_contest.top_axis, (candidate_top % 10)::smallint) - 1
      );

    INSERT INTO public.milestone_resolutions (
      contest_id,
      milestone,
      score_snapshot_id,
      side_score,
      top_score,
      side_digit,
      top_digit,
      assignment_id,
      participant_id,
      open_square,
      resolution_version,
      resolved_at
    )
    VALUES (
      p_contest_id,
      milestone_name,
      p_snapshot_id,
      candidate_side,
      candidate_top,
      candidate_side % 10,
      candidate_top % 10,
      winner_assignment.id,
      winner_assignment.participant_id,
      winner_assignment.id IS NULL,
      1,
      clock_timestamp()
    )
    RETURNING id INTO new_resolution_id;

    confirmed_ids := array_append(confirmed_ids, new_resolution_id);

    DELETE FROM public.pending_resolutions pending
    WHERE pending.contest_id = p_contest_id
      AND pending.milestone = milestone_name;

    INSERT INTO public.notification_deliveries (
      resolution_id,
      subscription_id,
      notification_kind,
      idempotency_key
    )
    SELECT
      new_resolution_id,
      subscription.id,
      'winner',
      'winner:' || new_resolution_id::text || ':' || subscription.id::text
    FROM public.notification_subscriptions subscription
    WHERE winner_assignment.id IS NOT NULL
      AND subscription.contest_id = p_contest_id
      AND subscription.participant_id = winner_assignment.participant_id
      AND subscription.status = 'verified'
      AND subscription.created_at <= clock_timestamp()
    ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT projection.winner_history, projection.pending_milestones
  INTO projected_history, projected_pending
  FROM public.gridone_project_milestones(p_contest_id) projection;

  RETURN QUERY SELECT projected_history, projected_pending, confirmed_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_observe_milestones_unchecked(uuid, uuid)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gridone_correct_milestone(
  p_contest_id uuid,
  p_owner_id uuid,
  p_milestone text,
  p_expected_version integer,
  p_side_score integer,
  p_top_score integer,
  p_reason text
)
RETURNS TABLE (
  resolution jsonb,
  winner_history jsonb,
  pending_milestones jsonb,
  delivery_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_contest public.contests%ROWTYPE;
  previous_resolution public.milestone_resolutions%ROWTYPE;
  corrected_resolution public.milestone_resolutions%ROWTYPE;
  winner_assignment public.square_assignments%ROWTYPE;
  projected_history jsonb;
  projected_pending jsonb;
  queued_delivery_ids uuid[] := ARRAY[]::uuid[];
  corrected_at_value timestamptz := clock_timestamp();
BEGIN
  IF p_milestone NOT IN ('Q1', 'Q2', 'Q3', 'FINAL') THEN
    RAISE EXCEPTION 'Unsupported milestone';
  END IF;
  IF p_side_score NOT BETWEEN 0 AND 255 OR p_top_score NOT BETWEEN 0 AND 255 THEN
    RAISE EXCEPTION 'Milestone score is outside the supported range';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'Correction reason must contain 3 to 500 characters';
  END IF;

  SELECT contest.*
  INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
    AND contest.owner_id = p_owner_id
    AND contest.published_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Published board not found';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_contest_id::text || ':' || p_milestone, 0)
  );

  SELECT existing.*
  INTO previous_resolution
  FROM public.milestone_resolutions existing
  WHERE existing.contest_id = p_contest_id
    AND existing.milestone = p_milestone
  ORDER BY existing.resolution_version DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone has not been confirmed';
  END IF;
  IF previous_resolution.resolution_version <> p_expected_version THEN
    RAISE EXCEPTION 'Milestone correction is stale';
  END IF;

  winner_assignment := NULL;
  SELECT assignment.*
  INTO winner_assignment
  FROM public.square_assignments assignment
  WHERE assignment.contest_id = p_contest_id
    AND assignment.cell_index = (
      (array_position(current_contest.side_axis, (p_side_score % 10)::smallint) - 1) * 10
      + array_position(current_contest.top_axis, (p_top_score % 10)::smallint) - 1
    );

  INSERT INTO public.milestone_resolutions (
    contest_id,
    milestone,
    score_snapshot_id,
    side_score,
    top_score,
    side_digit,
    top_digit,
    assignment_id,
    participant_id,
    open_square,
    resolution_version,
    supersedes_resolution_id,
    corrected_by,
    corrected_at,
    correction_reason,
    resolved_at
  )
  VALUES (
    p_contest_id,
    p_milestone,
    NULL,
    p_side_score,
    p_top_score,
    p_side_score % 10,
    p_top_score % 10,
    winner_assignment.id,
    winner_assignment.participant_id,
    winner_assignment.id IS NULL,
    previous_resolution.resolution_version + 1,
    previous_resolution.id,
    p_owner_id,
    corrected_at_value,
    btrim(p_reason),
    corrected_at_value
  )
  RETURNING * INTO corrected_resolution;

  DELETE FROM public.pending_resolutions pending
  WHERE pending.contest_id = p_contest_id
    AND pending.milestone = p_milestone;

  INSERT INTO public.contest_audit_events (
    contest_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    previous_revision,
    next_revision,
    details
  )
  VALUES (
    p_contest_id,
    p_owner_id,
    'milestone.corrected',
    'milestone_resolution',
    corrected_resolution.id,
    previous_resolution.resolution_version,
    corrected_resolution.resolution_version,
    jsonb_build_object(
      'milestone', p_milestone,
      'previousResolutionId', previous_resolution.id,
      'previousSideScore', previous_resolution.side_score,
      'previousTopScore', previous_resolution.top_score,
      'previousOpenSquare', previous_resolution.open_square,
      'sideScore', p_side_score,
      'topScore', p_top_score,
      'openSquare', winner_assignment.id IS NULL,
      'reason', btrim(p_reason)
    )
  );

  WITH queued AS (
    INSERT INTO public.notification_deliveries (
      resolution_id,
      subscription_id,
      notification_kind,
      idempotency_key
    )
    SELECT
      corrected_resolution.id,
      subscription.id,
      target.notification_kind,
      'correction:' || corrected_resolution.id::text || ':'
        || target.notification_kind || ':' || subscription.id::text
    FROM (
      VALUES
        (previous_resolution.participant_id, 'correction_previous'::text),
        (corrected_resolution.participant_id, 'correction_current'::text)
    ) AS target(participant_id, notification_kind)
    JOIN public.notification_subscriptions subscription
      ON subscription.contest_id = p_contest_id
     AND subscription.participant_id = target.participant_id
     AND subscription.status = 'verified'
     AND subscription.created_at <= corrected_at_value
    WHERE target.participant_id IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT coalesce(array_agg(queued.id ORDER BY queued.id), ARRAY[]::uuid[])
  INTO queued_delivery_ids
  FROM queued;

  SELECT projection.winner_history, projection.pending_milestones
  INTO projected_history, projected_pending
  FROM public.gridone_project_milestones(p_contest_id) projection;

  RETURN QUERY SELECT
    to_jsonb(corrected_resolution),
    projected_history,
    projected_pending,
    queued_delivery_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_correct_milestone(
  uuid,
  uuid,
  text,
  integer,
  integer,
  integer,
  text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_correct_milestone(
  uuid,
  uuid,
  text,
  integer,
  integer,
  integer,
  text
) TO service_role;


-- General owner updates remain unable to mutate a published board document.
-- Only the service-role late-fill RPC can open this narrow transaction-local
-- exception; the RPC itself accepts squares only, never axes or other fields.
CREATE OR REPLACE FUNCTION public.gridone_protect_published_board_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL
    AND NEW.board_data IS DISTINCT FROM OLD.board_data
    AND current_setting('gridone.published_fill_contest', true)
      IS DISTINCT FROM OLD.id::text
  THEN
    RAISE EXCEPTION 'Published board assignments and number axes are locked';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_protect_published_board_data()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gridone_fill_open_squares(
  p_contest_id uuid,
  p_owner_id uuid,
  p_expected_revision bigint,
  p_normalized_names jsonb
)
RETURNS TABLE (
  contest_id uuid,
  next_revision bigint,
  contest_updated_at timestamptz,
  filled_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_contest public.contests%ROWTYPE;
  updated_contest public.contests%ROWTYPE;
  current_names jsonb;
  changed_count integer := 0;
  snapshot_count integer := 0;
BEGIN
  SELECT contest.*
    INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
    AND contest.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND OR current_contest.revision <> p_expected_revision THEN
    RETURN;
  END IF;

  IF current_contest.published_at IS NULL
    OR NOT current_contest.allow_open_squares
  THEN
    RAISE EXCEPTION 'Only an open-square published board can accept late assignments';
  END IF;

  IF current_contest.game_starts_at IS NULL THEN
    RAISE EXCEPTION 'The board kickoff is unavailable';
  END IF;

  IF clock_timestamp() >= current_contest.game_starts_at THEN
    RAISE EXCEPTION 'This board is frozen at kickoff';
  END IF;

  current_names := current_contest.board_data -> 'squares';
  IF jsonb_typeof(current_names) IS DISTINCT FROM 'array'
    OR jsonb_array_length(current_names) <> 100
    OR jsonb_typeof(p_normalized_names) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_normalized_names) <> 100
  THEN
    RAISE EXCEPTION 'The board must contain exactly 100 squares';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_normalized_names) proposed(value)
    WHERE jsonb_typeof(proposed.value) IS DISTINCT FROM 'array'
      OR jsonb_array_length(proposed.value) > 1
      OR (
        jsonb_array_length(proposed.value) = 1
        AND (
          jsonb_typeof(proposed.value -> 0) IS DISTINCT FROM 'string'
          OR char_length(btrim(proposed.value ->> 0)) NOT BETWEEN 1 AND 80
          OR proposed.value ->> 0 <> btrim(proposed.value ->> 0)
        )
      )
  ) THEN
    RAISE EXCEPTION 'Every square must be open or contain exactly one purchaser name';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(current_names) WITH ORDINALITY current_cell(value, ordinality)
    JOIN jsonb_array_elements(p_normalized_names) WITH ORDINALITY proposed(value, ordinality)
      USING (ordinality)
    WHERE
      jsonb_typeof(current_cell.value) IS DISTINCT FROM 'array'
      OR jsonb_array_length(current_cell.value) > 1
      OR (
        jsonb_array_length(current_cell.value) = 1
        AND proposed.value IS DISTINCT FROM current_cell.value
      )
  ) THEN
    RAISE EXCEPTION 'Occupied squares cannot be changed or cleared';
  END IF;

  SELECT count(*)::integer
    INTO changed_count
  FROM jsonb_array_elements(current_names) WITH ORDINALITY current_cell(value, ordinality)
  JOIN jsonb_array_elements(p_normalized_names) WITH ORDINALITY proposed(value, ordinality)
    USING (ordinality)
  WHERE jsonb_array_length(current_cell.value) = 0
    AND jsonb_array_length(proposed.value) = 1;

  IF changed_count = 0 THEN
    RAISE EXCEPTION 'Assign at least one open square';
  END IF;

  PERFORM pg_catalog.set_config(
    'gridone.published_fill_contest',
    current_contest.id::text,
    true
  );

  UPDATE public.contests contest
  SET board_data = jsonb_set(
    contest.board_data,
    '{squares}',
    p_normalized_names,
    true
  )
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
    proposed.value ->> 0,
    public.gridone_public_participant_label(proposed.value ->> 0)
  FROM jsonb_array_elements(current_names) WITH ORDINALITY current_cell(value, ordinality)
  JOIN jsonb_array_elements(p_normalized_names) WITH ORDINALITY proposed(value, ordinality)
    USING (ordinality)
  WHERE jsonb_array_length(current_cell.value) = 0
    AND jsonb_array_length(proposed.value) = 1
  ON CONFLICT ON CONSTRAINT contest_participants_name_key DO UPDATE
    SET public_label = EXCLUDED.public_label,
        updated_at = clock_timestamp();

  INSERT INTO public.square_assignments (
    contest_id,
    cell_index,
    participant_id
  )
  SELECT
    current_contest.id,
    (proposed.ordinality - 1)::smallint,
    participant.id
  FROM jsonb_array_elements(current_names) WITH ORDINALITY current_cell(value, ordinality)
  JOIN jsonb_array_elements(p_normalized_names) WITH ORDINALITY proposed(value, ordinality)
    USING (ordinality)
  JOIN public.contest_participants participant
    ON participant.contest_id = current_contest.id
   AND participant.display_name = proposed.value ->> 0
  WHERE jsonb_array_length(current_cell.value) = 0
    AND jsonb_array_length(proposed.value) = 1;

  UPDATE public.public_board_snapshots snapshot
  SET
    revision = updated_contest.revision,
    board = jsonb_set(
      snapshot.board,
      '{squares}',
      p_normalized_names,
      true
    ) || jsonb_build_object(
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
            FROM public.square_assignments assignment
            WHERE assignment.contest_id = current_contest.id
              AND assignment.participant_id = participant.id
          )
      )
    ),
    updated_at = updated_contest.updated_at
  WHERE snapshot.contest_id = current_contest.id
    AND snapshot.withdrawn_at IS NULL;

  GET DIAGNOSTICS snapshot_count = ROW_COUNT;
  IF snapshot_count <> 1 THEN
    RAISE EXCEPTION 'Published board projection is unavailable';
  END IF;

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
    'board.open_squares_filled',
    current_contest.revision,
    updated_contest.revision,
    jsonb_build_object(
      'filledCount', changed_count,
      'openSquareCount',
        (
          SELECT count(*)::integer
          FROM jsonb_array_elements(p_normalized_names) cell(value)
          WHERE jsonb_array_length(cell.value) = 0
        )
    )
  );

  RETURN QUERY SELECT
    updated_contest.id,
    updated_contest.revision,
    updated_contest.updated_at,
    changed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_fill_open_squares(
  uuid,
  uuid,
  bigint,
  jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_fill_open_squares(
  uuid,
  uuid,
  bigint,
  jsonb
) TO service_role;
