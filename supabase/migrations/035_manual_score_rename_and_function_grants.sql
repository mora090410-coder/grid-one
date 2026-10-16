-- Manual scores, published renames, and internal function grants.
--
-- 1. A manual score cannot be published before kickoff. The database clock is
--    the authority, so a caller cannot pass a future observed_at to slip past it.
-- 2. A quarter the organizer left blank (JSON null) does not settle. An explicit
--    0 still does. Final can settle from the entered total without awarding the
--    blank quarters to the 0-0 square.
-- 3. A milestone correction can be saved without queueing winner email.
-- 4. A rename before a quarter resolves updates the assignment, the participant,
--    and the public participant list that winner resolution reads. A square that
--    already appears on a published result keeps that name.
-- 5. Supabase grants EXECUTE to anon and authenticated by default. REVOKE FROM
--    PUBLIC does not remove those direct grants. Internal SECURITY DEFINER
--    functions are revoked from both roles. The legacy v1 score-refresh lease
--    is dropped; live refresh uses gridone_acquire_score_refresh_lease_v2.

-- ── Kickoff guard ────────────────────────────────────────────────────────────

DO $migration$
DECLARE
  definition text;
  old_text text := $old$
  IF p_game_state NOT IN ('pre', 'in', 'post')
    OR p_period NOT BETWEEN 0 AND 5
    OR p_side_score NOT BETWEEN 0 AND 255
    OR p_top_score NOT BETWEEN 0 AND 255
    OR jsonb_typeof(p_quarter_scores) <> 'object'
  THEN
    RAISE EXCEPTION 'Manual score is invalid';
  END IF;
$old$;
  new_text text := $new$
  IF p_game_state NOT IN ('pre', 'in', 'post')
    OR p_period NOT BETWEEN 0 AND 5
    OR p_side_score NOT BETWEEN 0 AND 255
    OR p_top_score NOT BETWEEN 0 AND 255
    OR jsonb_typeof(p_quarter_scores) <> 'object'
  THEN
    RAISE EXCEPTION 'Manual score is invalid';
  END IF;
  IF current_contest.game_starts_at IS NULL THEN
    RAISE EXCEPTION 'The board kickoff is unavailable';
  END IF;
  IF clock_timestamp() < current_contest.game_starts_at THEN
    RAISE EXCEPTION 'Manual scores cannot be published before kickoff';
  END IF;
$new$;
BEGIN
  definition := pg_get_functiondef('public.gridone_commit_manual_score(uuid,uuid,text,smallint,smallint,smallint,jsonb,text,timestamptz)'::regprocedure);
  IF (length(definition) - length(replace(definition, old_text, ''))) / length(old_text) <> 1 THEN
    RAISE EXCEPTION 'Manual score migration prerequisite mismatch: commit validation';
  END IF;
  EXECUTE replace(definition, old_text, new_text);
END
$migration$;

-- ── Blank quarters do not settle ─────────────────────────────────────────────
-- A side is entered only when it is a JSON number, including 0. Null or a
-- missing key is blank. Q2 and Q3 need every earlier quarter, because those
-- results are running totals. Final still uses the snapshot total.

DO $migration$
DECLARE
  definition text;
  old_text text := $old$
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
$old$;
  new_text text := $new$
    milestone_eligible := (
      CASE milestone_name
        WHEN 'Q1' THEN observed_snapshot.period > 1 OR observed_snapshot.game_state = 'post'
        WHEN 'Q2' THEN observed_snapshot.period > 2 OR observed_snapshot.game_state = 'post'
          OR (
            observed_snapshot.period = 2
            AND observed_snapshot.game_state = 'in'
            AND lower(btrim(coalesce(observed_snapshot.detail, ''))) = 'halftime'
          )
        WHEN 'Q3' THEN observed_snapshot.period > 3 OR observed_snapshot.game_state = 'post'
        ELSE observed_snapshot.game_state = 'post'
      END
    ) AND (
      CASE milestone_name
        WHEN 'Q1' THEN
          jsonb_typeof(observed_snapshot.quarter_scores -> 'Q1' -> 'left') = 'number'
          AND jsonb_typeof(observed_snapshot.quarter_scores -> 'Q1' -> 'top') = 'number'
        WHEN 'Q2' THEN
          jsonb_typeof(observed_snapshot.quarter_scores -> 'Q1' -> 'left') = 'number'
          AND jsonb_typeof(observed_snapshot.quarter_scores -> 'Q1' -> 'top') = 'number'
          AND jsonb_typeof(observed_snapshot.quarter_scores -> 'Q2' -> 'left') = 'number'
          AND jsonb_typeof(observed_snapshot.quarter_scores -> 'Q2' -> 'top') = 'number'
        WHEN 'Q3' THEN
          jsonb_typeof(observed_snapshot.quarter_scores -> 'Q1' -> 'left') = 'number'
          AND jsonb_typeof(observed_snapshot.quarter_scores -> 'Q1' -> 'top') = 'number'
          AND jsonb_typeof(observed_snapshot.quarter_scores -> 'Q2' -> 'left') = 'number'
          AND jsonb_typeof(observed_snapshot.quarter_scores -> 'Q2' -> 'top') = 'number'
          AND jsonb_typeof(observed_snapshot.quarter_scores -> 'Q3' -> 'left') = 'number'
          AND jsonb_typeof(observed_snapshot.quarter_scores -> 'Q3' -> 'top') = 'number'
        ELSE true
      END
    );
$new$;
BEGIN
  definition := pg_get_functiondef('public.gridone_observe_milestones_unchecked(uuid,uuid)'::regprocedure);
  IF (length(definition) - length(replace(definition, old_text, ''))) / length(old_text) <> 1 THEN
    RAISE EXCEPTION 'Manual score migration prerequisite mismatch: milestone eligibility';
  END IF;
  EXECUTE replace(definition, old_text, new_text);
END
$migration$;

-- ── Correct without notifying ────────────────────────────────────────────────
-- The seven-argument function stays so existing callers still queue email.
-- It delegates to the eight-argument function, which records the choice.

CREATE FUNCTION public.gridone_correct_milestone(
  p_contest_id uuid,
  p_owner_id uuid,
  p_milestone text,
  p_expected_version integer,
  p_side_score integer,
  p_top_score integer,
  p_reason text,
  p_notify boolean
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
  notify_recipients boolean := coalesce(p_notify, true);
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
      (array_position(public.gridone_axis_for_milestone(current_contest.board_data, current_contest.side_axis, 'left', p_milestone), (p_side_score % 10)::smallint) - 1) * 10
      + array_position(public.gridone_axis_for_milestone(current_contest.board_data, current_contest.top_axis, 'top', p_milestone), (p_top_score % 10)::smallint) - 1
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
      'reason', btrim(p_reason),
      'notify', notify_recipients
    )
  );

  IF notify_recipients THEN
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
  END IF;

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
  uuid, uuid, text, integer, integer, integer, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_correct_milestone(
  uuid, uuid, text, integer, integer, integer, text, boolean
) TO service_role;

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
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.gridone_correct_milestone(
    p_contest_id,
    p_owner_id,
    p_milestone,
    p_expected_version,
    p_side_score,
    p_top_score,
    p_reason,
    true
  );
END;
$$;

-- ── Published renames follow the buyer, then freeze ─────────────────────────

CREATE OR REPLACE FUNCTION public.gridone_rename_published_square(
  p_contest_id uuid,
  p_cell_index integer,
  p_new_name text
) RETURNS TABLE (cell_index integer, previous_name text, new_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner uuid;
  v_published timestamptz;
  v_board jsonb;
  v_previous text;
  v_next text;
  v_cell jsonb;
  v_assignment_id uuid;
  v_old_participant uuid;
  v_target_participant uuid;
  v_other_squares integer;
BEGIN
  IF p_cell_index IS NULL OR p_cell_index < 0 OR p_cell_index > 99 THEN
    RAISE EXCEPTION 'Square index must be between 0 and 99';
  END IF;

  v_next := nullif(btrim(coalesce(p_new_name, '')), '');
  IF v_next IS NOT NULL AND char_length(v_next) > 80 THEN
    RAISE EXCEPTION 'Names are limited to 80 characters';
  END IF;

  SELECT owner_id, published_at, board_data
    INTO v_owner, v_published, v_board
  FROM public.contests
  WHERE id = p_contest_id
  FOR UPDATE;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Board not found';
  END IF;
  IF v_owner IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the organizer can rename a square';
  END IF;
  IF v_published IS NULL THEN
    RAISE EXCEPTION 'Board is not published; edit it directly instead';
  END IF;

  v_previous := nullif(btrim(coalesce(v_board -> 'squares' -> p_cell_index ->> 0, '')), '');
  IF v_previous IS NOT DISTINCT FROM v_next THEN
    RETURN QUERY SELECT p_cell_index, v_previous, v_next;
    RETURN;
  END IF;

  SELECT assignment.id, assignment.participant_id
    INTO v_assignment_id, v_old_participant
  FROM public.square_assignments assignment
  WHERE assignment.contest_id = p_contest_id
    AND assignment.cell_index = p_cell_index::smallint
  FOR UPDATE;

  -- Any published version that named this square keeps that name. Later
  -- quarters on other squares can still be renamed.
  IF v_assignment_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.milestone_resolutions resolution
    WHERE resolution.assignment_id = v_assignment_id
  ) THEN
    RAISE EXCEPTION 'This square already has a published result, so its name is locked.';
  END IF;

  v_cell := CASE WHEN v_next IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_next) END;

  PERFORM set_config('gridone.square_rename', 'on', true);

  UPDATE public.contests
     SET board_data = jsonb_set(board_data, ARRAY['squares', p_cell_index::text], v_cell, false),
         revision = revision + 1
   WHERE id = p_contest_id;

  IF v_next IS NULL THEN
    IF v_assignment_id IS NOT NULL THEN
      DELETE FROM public.square_assignments WHERE id = v_assignment_id;
    END IF;
  ELSE
    SELECT participant.id
      INTO v_target_participant
    FROM public.contest_participants participant
    WHERE participant.contest_id = p_contest_id
      AND participant.display_name = v_next;

    SELECT count(*)::integer
      INTO v_other_squares
    FROM public.square_assignments assignment
    WHERE assignment.participant_id = v_old_participant
      AND assignment.id IS DISTINCT FROM v_assignment_id;

    -- One placeholder on this square alone can be renamed in place, so a
    -- later unresolved quarter and any subscription stay with that person.
    -- A name shared with other squares, or already used by a result, gets a
    -- separate participant so those records keep the old name.
    IF v_target_participant IS NULL
      AND v_old_participant IS NOT NULL
      AND v_other_squares = 0
      AND NOT EXISTS (
        SELECT 1 FROM public.milestone_resolutions resolution
        WHERE resolution.participant_id = v_old_participant
      )
    THEN
      UPDATE public.contest_participants participant
         SET display_name = v_next,
             public_label = public.gridone_public_participant_label(v_next),
             updated_at = clock_timestamp()
       WHERE participant.id = v_old_participant;
      v_target_participant := v_old_participant;
    ELSIF v_target_participant IS NULL THEN
      INSERT INTO public.contest_participants (contest_id, display_name, public_label)
      VALUES (
        p_contest_id,
        v_next,
        public.gridone_public_participant_label(v_next)
      )
      RETURNING id INTO v_target_participant;
    END IF;

    IF v_assignment_id IS NULL THEN
      INSERT INTO public.square_assignments (contest_id, cell_index, participant_id)
      VALUES (p_contest_id, p_cell_index::smallint, v_target_participant);
    ELSIF v_target_participant IS DISTINCT FROM v_old_participant THEN
      UPDATE public.square_assignments assignment
         SET participant_id = v_target_participant,
             updated_at = clock_timestamp()
       WHERE assignment.id = v_assignment_id;
    END IF;
  END IF;

  IF v_old_participant IS NOT NULL
    AND v_old_participant IS DISTINCT FROM v_target_participant
    AND NOT EXISTS (
      SELECT 1 FROM public.square_assignments assignment
      WHERE assignment.participant_id = v_old_participant
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.milestone_resolutions resolution
      WHERE resolution.participant_id = v_old_participant
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_subscriptions subscription
      WHERE subscription.participant_id = v_old_participant
    )
  THEN
    DELETE FROM public.contest_participants WHERE id = v_old_participant;
  END IF;

  -- The snapshot trigger rebuilds participants from contest_participants.
  UPDATE public.public_board_snapshots
     SET board = jsonb_set(board, ARRAY['squares', p_cell_index::text], v_cell, false),
         revision = revision + 1,
         updated_at = now()
   WHERE contest_id = p_contest_id;

  PERFORM set_config('gridone.square_rename', 'off', true);

  INSERT INTO public.contest_square_edits (contest_id, cell_index, previous_name, new_name, changed_by)
  VALUES (p_contest_id, p_cell_index, v_previous, v_next, (SELECT auth.uid()));

  RETURN QUERY SELECT p_cell_index, v_previous, v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_rename_published_square(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gridone_rename_published_square(uuid, integer, text) TO authenticated;

-- ── Drop the legacy lease and lock internal functions ───────────────────────
-- v1 writes the same score_refresh_leases row the live v2 path uses.

DROP FUNCTION IF EXISTS public.gridone_acquire_score_refresh_lease(uuid, uuid, integer);

-- Organizer sessions still need these two SECURITY DEFINER functions:
--   gridone_rename_published_square — the browser rename RPC
--   gridone_owns_contest — row security for the organizer's own tables
-- Anon does not. Every other gridone SECURITY DEFINER function is internal:
-- the Pages Functions call it with the service role, a trigger fires it, or
-- another definer function calls it. service_role grants are left in place.
-- Trigger execution does not require the table writer to hold EXECUTE.

REVOKE ALL ON FUNCTION public.gridone_owns_contest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gridone_owns_contest(uuid) TO authenticated;

-- These are not SECURITY DEFINER, but authenticated organizers execute them
-- from a column default, a check, or a trigger that runs as the writer.
-- Anon does not insert or update boards.
REVOKE ALL ON FUNCTION public.gridone_generate_share_code() FROM anon;
REVOKE ALL ON FUNCTION public.gridone_valid_payout_descriptions(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.gridone_validate_number_sets(jsonb, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.gridone_validate_sales_board(jsonb) FROM anon;

DO $revoke$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname LIKE 'gridone_%'
      AND p.proname NOT IN ('gridone_rename_published_square', 'gridone_owns_contest')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END
$revoke$;
