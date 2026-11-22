-- Add a free atomic lifecycle alongside the pre-cutover RPCs. Existing apps and
-- historical payment records stay intact during a migration-first rollout.
-- Owner identity comes from the authenticated Pages endpoint. Never grant these
-- SECURITY DEFINER transaction entry points to client roles. Existing owner,
-- board, quarter, guest, scoring, and public-snapshot triggers stay in force.
BEGIN;

-- Preserve guarded access to shared_at and shared identity, dropping only the
-- retired activation requirement. Do not widen the existing column grants.
CREATE OR REPLACE FUNCTION public.gridone_protect_sales_sharing()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.shared_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.shared_at IS DISTINCT FROM OLD.shared_at) THEN
    IF current_user IN ('anon', 'authenticated') THEN
      RAISE EXCEPTION 'Use the organizer sharing endpoint to share a board';
    END IF;
  END IF;
  IF NEW.published_at IS NULL AND (NEW.shared_at IS NOT NULL OR NEW.board_data ? 'allocationLabels') THEN
    PERFORM public.gridone_validate_sales_board(NEW.board_data);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.shared_at IS NOT NULL THEN
    IF (
      NEW.share_code IS DISTINCT FROM OLD.share_code
      OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
      OR NEW.season_year IS DISTINCT FROM OLD.season_year
    ) THEN
      RAISE EXCEPTION 'Shared board identity is locked';
    END IF;
  END IF;
  -- Number mode remains enforced by gridone_protect_number_sets (032).
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_protect_sales_sharing() FROM PUBLIC;
CREATE FUNCTION public.gridone_share_free_board(
  p_contest_id uuid, p_owner_id uuid, p_expected_revision bigint
) RETURNS TABLE (shared boolean, share_code text, next_revision bigint, shared_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  current_contest public.contests%ROWTYPE;
  updated_contest public.contests%ROWTYPE;
BEGIN
  SELECT * INTO current_contest FROM public.contests contest
    WHERE contest.id = p_contest_id AND contest.owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND OR current_contest.revision IS DISTINCT FROM p_expected_revision THEN RETURN; END IF;
  IF current_contest.published_at IS NOT NULL OR current_contest.status NOT IN ('draft','reconciling','ready') THEN
    RAISE EXCEPTION 'Only a board in preparation can start sharing during sales';
  END IF;
  IF current_contest.game_external_id IS NULL THEN
    RAISE EXCEPTION 'Link a scheduled NFL game before sharing';
  END IF;
  PERFORM public.gridone_validate_sales_board(current_contest.board_data);
  IF current_contest.shared_at IS NULL THEN
    UPDATE public.contests contest SET shared_at = now()
      WHERE contest.id = current_contest.id RETURNING contest.* INTO updated_contest;
    INSERT INTO public.contest_audit_events
      (contest_id, actor_id, event_type, previous_revision, next_revision, details)
    VALUES (current_contest.id, p_owner_id, 'board.shared', current_contest.revision,
      updated_contest.revision, jsonb_build_object('share_code', current_contest.share_code));
  ELSE
    updated_contest := current_contest;
  END IF;
  RETURN QUERY SELECT true, updated_contest.share_code, updated_contest.revision,
    updated_contest.shared_at;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_share_free_board(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_share_free_board(uuid, uuid, bigint) TO service_role;

-- Based on the existing atomic publisher (022). It deliberately doesn't
-- copy historical account-level organization names onto new public boards;
-- an organization name on an existing public snapshot is left untouched.
CREATE FUNCTION public.gridone_publish_free_board(
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
  published_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_contest public.contests%ROWTYPE;
  updated_contest public.contests%ROWTYPE;
  publish_time timestamptz;
  open_square_count integer := 0;
BEGIN
  SELECT *
    INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
    AND contest.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND OR current_contest.revision IS DISTINCT FROM p_expected_revision THEN
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
      'allowOpenSquares', p_allow_open_squares,
      'openSquareCount', open_square_count
    )
  );

  RETURN QUERY SELECT
    true,
    updated_contest.share_code,
    updated_contest.revision,
    publish_time;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_publish_free_board(
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
GRANT EXECUTE ON FUNCTION public.gridone_publish_free_board(
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

COMMIT;
