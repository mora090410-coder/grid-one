-- Publish the immutable board and its viewer snapshot as one transaction.

CREATE OR REPLACE FUNCTION public.gridone_public_participant_label(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  name_parts text[];
BEGIN
  name_parts := regexp_split_to_array(btrim(p_name), '\s+');
  IF cardinality(name_parts) <= 1 THEN
    RETURN upper(left(btrim(p_name), 2));
  END IF;
  RETURN upper(left(name_parts[1], 1) || left(name_parts[cardinality(name_parts)], 1));
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_public_participant_label(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gridone_publish_board(
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
BEGIN
  SELECT *
    INTO current_contest
  FROM public.contests c
  WHERE c.id = p_contest_id
    AND c.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND OR current_contest.revision <> p_expected_revision THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.board_activations activation
    WHERE activation.contest_id = current_contest.id
  ) THEN
    RAISE EXCEPTION 'Board activation is required before publishing';
  END IF;

  IF current_contest.game_external_id IS NULL THEN
    RAISE EXCEPTION 'Link a scheduled NFL game before publishing';
  END IF;

  IF cardinality(p_side_axis) <> 10 OR cardinality(p_top_axis) <> 10 THEN
    RAISE EXCEPTION 'Draw all ten unique axis digits before publishing';
  END IF;

  IF jsonb_typeof(p_normalized_names) <> 'array'
    OR jsonb_array_length(p_normalized_names) <> 100
  THEN
    RAISE EXCEPTION 'The board must contain exactly 100 squares';
  END IF;

  publish_time := coalesce(current_contest.published_at, now());

  UPDATE public.contests c
  SET
    status = 'published',
    side_axis = p_side_axis,
    top_axis = p_top_axis,
    axis_locked_at = coalesce(c.axis_locked_at, publish_time),
    axis_locked_by = coalesce(c.axis_locked_by, p_owner_id),
    published_at = publish_time
  WHERE c.id = current_contest.id
    AND c.revision = p_expected_revision
  RETURNING c.* INTO updated_contest;

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
    jsonb_build_object('share_code', current_contest.share_code)
  );

  RETURN QUERY SELECT
    true,
    updated_contest.share_code,
    updated_contest.revision,
    publish_time;
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
