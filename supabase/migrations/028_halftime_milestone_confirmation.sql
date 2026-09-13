-- ESPN remains in period 2 throughout halftime. An explicit Halftime state
-- makes Q2 eligible without waiting for Q3; a zero clock alone is insufficient.
-- Retains the existing two distinct stable reads >=45s apart, score-change
-- resets, manual authority, OPEN outcomes, notification deduplication and grants.
-- Function body otherwise matches 022_open_squares.sql.

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
        OR (
          observed_snapshot.period = 2
          AND observed_snapshot.game_state = 'in'
          AND lower(btrim(coalesce(observed_snapshot.detail, ''))) = 'halftime'
        )
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
