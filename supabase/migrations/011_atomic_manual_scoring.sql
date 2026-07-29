-- Commit organizer-entered scores and score-mode transitions as indivisible
-- database operations. Provider/network work remains outside these RPCs.

CREATE OR REPLACE FUNCTION public.gridone_commit_manual_score(
  p_contest_id uuid,
  p_owner_id uuid,
  p_game_state text,
  p_period smallint,
  p_side_score smallint,
  p_top_score smallint,
  p_quarter_scores jsonb,
  p_clock text,
  p_observed_at timestamptz
)
RETURNS SETOF public.score_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_contest public.contests%ROWTYPE;
  committed_snapshot public.score_snapshots%ROWTYPE;
  promoted boolean;
  projected_rows integer;
  public_score jsonb;
BEGIN
  SELECT *
    INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
    AND contest.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found';
  END IF;
  IF p_game_state NOT IN ('pre', 'in', 'post')
    OR p_period NOT BETWEEN 0 AND 5
    OR p_side_score NOT BETWEEN 0 AND 255
    OR p_top_score NOT BETWEEN 0 AND 255
    OR jsonb_typeof(p_quarter_scores) <> 'object'
  THEN
    RAISE EXCEPTION 'Manual score is invalid';
  END IF;

  INSERT INTO public.contest_score_state (
    contest_id,
    scoring_mode,
    manual_mode_started_at,
    manual_mode_started_by,
    updated_at
  )
  VALUES (
    current_contest.id,
    'manual',
    p_observed_at,
    p_owner_id,
    p_observed_at
  )
  ON CONFLICT (contest_id) DO UPDATE
    SET scoring_mode = 'manual',
        manual_mode_started_at = EXCLUDED.manual_mode_started_at,
        manual_mode_started_by = EXCLUDED.manual_mode_started_by,
        updated_at = EXCLUDED.updated_at;

  INSERT INTO public.score_snapshots (
    contest_id,
    source_mode,
    provider,
    game_state,
    period,
    side_score,
    top_score,
    quarter_scores,
    clock,
    detail,
    validation_status,
    source_name,
    source_observed_at,
    retrieved_at,
    stale_after,
    created_by
  )
  VALUES (
    current_contest.id,
    'manual',
    'organizer',
    p_game_state,
    p_period,
    p_side_score,
    p_top_score,
    p_quarter_scores,
    left(coalesce(p_clock, ''), 32),
    'Organizer-entered score',
    'accepted',
    'Organizer',
    p_observed_at,
    p_observed_at,
    p_observed_at + interval '1 year',
    p_owner_id
  )
  RETURNING * INTO committed_snapshot;

  SELECT public.gridone_promote_score_snapshot(
    current_contest.id,
    committed_snapshot.id
  ) INTO promoted;
  IF NOT promoted THEN
    RAISE EXCEPTION 'Manual score could not become current';
  END IF;

  -- Read back promotion-owned fields before returning the committed row.
  SELECT *
    INTO committed_snapshot
  FROM public.score_snapshots snapshot
  WHERE snapshot.id = committed_snapshot.id;

  public_score := jsonb_build_object(
    'leftScore', committed_snapshot.side_score,
    'topScore', committed_snapshot.top_score,
    'quarterScores', committed_snapshot.quarter_scores,
    'clock', coalesce(committed_snapshot.clock, ''),
    'period', committed_snapshot.period,
    'state', committed_snapshot.game_state,
    'detail', coalesce(committed_snapshot.detail, ''),
    'isOvertime', committed_snapshot.period > 4,
    'isManual', true,
    'sourceName', 'Organizer',
    'sourceObservedAt', committed_snapshot.source_observed_at,
    'retrievedAt', committed_snapshot.retrieved_at,
    'staleAfter', committed_snapshot.stale_after,
    'freshness', 'fresh'
  );

  UPDATE public.public_board_snapshots snapshot
  SET
    score = public_score,
    updated_at = p_observed_at
  WHERE snapshot.contest_id = current_contest.id;
  GET DIAGNOSTICS projected_rows = ROW_COUNT;

  IF current_contest.published_at IS NOT NULL AND projected_rows <> 1 THEN
    RAISE EXCEPTION 'Published score projection is unavailable';
  END IF;

  INSERT INTO public.contest_audit_events (
    contest_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    current_contest.id,
    p_owner_id,
    'score.manual_updated',
    'score_snapshot',
    committed_snapshot.id,
    jsonb_build_object(
      'state', committed_snapshot.game_state,
      'period', committed_snapshot.period
    )
  );

  RETURN NEXT committed_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_commit_manual_score(
  uuid,
  uuid,
  text,
  smallint,
  smallint,
  smallint,
  jsonb,
  text,
  timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_commit_manual_score(
  uuid,
  uuid,
  text,
  smallint,
  smallint,
  smallint,
  jsonb,
  text,
  timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION public.gridone_enable_automatic_scoring(
  p_contest_id uuid,
  p_owner_id uuid,
  p_changed_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_contest public.contests%ROWTYPE;
BEGIN
  SELECT *
    INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
    AND contest.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found';
  END IF;
  IF current_contest.game_external_id IS NULL THEN
    RAISE EXCEPTION 'Link this legacy board to a scheduled NFL game before enabling automatic scoring';
  END IF;

  INSERT INTO public.contest_score_state (contest_id)
  VALUES (current_contest.id)
  ON CONFLICT (contest_id) DO NOTHING;

  PERFORM 1
  FROM public.contest_score_state state
  WHERE state.contest_id = current_contest.id
  FOR UPDATE;

  UPDATE public.score_snapshots snapshot
  SET is_current = false
  WHERE snapshot.contest_id = current_contest.id
    AND snapshot.is_current;

  UPDATE public.contest_score_state state
  SET
    scoring_mode = 'automatic',
    current_snapshot_id = NULL,
    manual_mode_started_at = NULL,
    manual_mode_started_by = NULL,
    updated_at = p_changed_at
  WHERE state.contest_id = current_contest.id;

  INSERT INTO public.contest_audit_events (
    contest_id,
    actor_id,
    event_type,
    details
  )
  VALUES (
    current_contest.id,
    p_owner_id,
    'score.automatic_enabled',
    '{}'::jsonb
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_enable_automatic_scoring(
  uuid,
  uuid,
  timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_enable_automatic_scoring(
  uuid,
  uuid,
  timestamptz
) TO service_role;
