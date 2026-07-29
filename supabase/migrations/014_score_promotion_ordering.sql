-- Make score authority monotonic from refresh start through canonical and
-- public projection. Automatic work is valid only within the authority
-- generation and refresh sequence captured before the provider request.

ALTER TABLE public.contest_score_state
  ADD COLUMN authority_generation bigint NOT NULL DEFAULT 1
    CHECK (authority_generation > 0),
  ADD COLUMN latest_refresh_sequence bigint NOT NULL DEFAULT 0
    CHECK (latest_refresh_sequence >= 0),
  ADD COLUMN promoted_refresh_sequence bigint NOT NULL DEFAULT 0
    CHECK (
      promoted_refresh_sequence >= 0
      AND promoted_refresh_sequence <= latest_refresh_sequence
    );

ALTER TABLE public.score_refresh_leases
  ADD COLUMN authority_generation bigint NOT NULL DEFAULT 1
    CHECK (authority_generation > 0),
  ADD COLUMN refresh_sequence bigint NOT NULL DEFAULT 0
    CHECK (refresh_sequence >= 0);

ALTER TABLE public.score_snapshots
  ADD COLUMN authority_generation bigint,
  ADD COLUMN refresh_sequence bigint,
  ADD COLUMN refresh_started_at timestamptz;

ALTER TABLE public.score_snapshots
  ADD CONSTRAINT score_snapshots_automatic_authority_check
  CHECK (
    source_mode <> 'automatic'
    OR (
      authority_generation IS NOT NULL
      AND authority_generation > 0
      AND refresh_sequence IS NOT NULL
      AND refresh_sequence > 0
      AND refresh_started_at IS NOT NULL
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.gridone_acquire_score_refresh_lease_v2(
  p_contest_id uuid,
  p_lease_token uuid,
  p_seconds integer DEFAULT 30
)
RETURNS TABLE (
  acquired boolean,
  scoring_mode text,
  authority_generation bigint,
  refresh_sequence bigint,
  refresh_started_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  state_row public.contest_score_state%ROWTYPE;
  acquired_token uuid;
  next_sequence bigint;
  started_at timestamptz;
BEGIN
  INSERT INTO public.contest_score_state (contest_id)
  VALUES (p_contest_id)
  ON CONFLICT (contest_id) DO NOTHING;

  SELECT *
    INTO state_row
  FROM public.contest_score_state state
  WHERE state.contest_id = p_contest_id
  FOR UPDATE;

  IF state_row.scoring_mode = 'manual' THEN
    RETURN QUERY SELECT
      false,
      state_row.scoring_mode,
      state_row.authority_generation,
      state_row.latest_refresh_sequence,
      NULL::timestamptz;
    RETURN;
  END IF;

  next_sequence := state_row.latest_refresh_sequence + 1;
  started_at := clock_timestamp();

  INSERT INTO public.score_refresh_leases (
    contest_id,
    lease_token,
    locked_until,
    requested_at,
    authority_generation,
    refresh_sequence
  )
  VALUES (
    p_contest_id,
    p_lease_token,
    started_at + make_interval(secs => greatest(5, least(p_seconds, 120))),
    started_at,
    state_row.authority_generation,
    next_sequence
  )
  ON CONFLICT (contest_id) DO UPDATE
    SET
      lease_token = EXCLUDED.lease_token,
      locked_until = EXCLUDED.locked_until,
      requested_at = EXCLUDED.requested_at,
      authority_generation = EXCLUDED.authority_generation,
      refresh_sequence = EXCLUDED.refresh_sequence
    WHERE public.score_refresh_leases.locked_until <= clock_timestamp()
  RETURNING lease_token INTO acquired_token;

  IF acquired_token IS DISTINCT FROM p_lease_token THEN
    RETURN QUERY SELECT
      false,
      state_row.scoring_mode,
      state_row.authority_generation,
      state_row.latest_refresh_sequence,
      NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE public.contest_score_state state
  SET
    latest_refresh_sequence = next_sequence,
    revision = state.revision + 1,
    updated_at = started_at
  WHERE state.contest_id = p_contest_id
  RETURNING * INTO state_row;

  RETURN QUERY SELECT
    true,
    state_row.scoring_mode,
    state_row.authority_generation,
    next_sequence,
    started_at;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_acquire_score_refresh_lease_v2(
  uuid,
  uuid,
  integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_acquire_score_refresh_lease_v2(
  uuid,
  uuid,
  integer
) TO service_role;

CREATE OR REPLACE FUNCTION public.gridone_invalidate_score_refresh_on_mode_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.scoring_mode IS DISTINCT FROM OLD.scoring_mode THEN
    DELETE FROM public.score_refresh_leases lease
    WHERE lease.contest_id = NEW.contest_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_invalidate_score_refresh_on_mode_change()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER gridone_invalidate_score_refresh_on_mode_change
  AFTER UPDATE OF scoring_mode
  ON public.contest_score_state
  FOR EACH ROW
  EXECUTE FUNCTION public.gridone_invalidate_score_refresh_on_mode_change();

CREATE OR REPLACE FUNCTION public.gridone_promote_score_snapshot(
  p_contest_id uuid,
  p_snapshot_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  next_snapshot public.score_snapshots%ROWTYPE;
  state_row public.contest_score_state%ROWTYPE;
  lease_row public.score_refresh_leases%ROWTYPE;
  current_contest public.contests%ROWTYPE;
  projected_rows integer;
  public_score jsonb;
BEGIN
  SELECT *
    INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.contest_score_state (contest_id)
  VALUES (p_contest_id)
  ON CONFLICT (contest_id) DO NOTHING;

  SELECT *
    INTO state_row
  FROM public.contest_score_state state
  WHERE state.contest_id = p_contest_id
  FOR UPDATE;

  SELECT *
    INTO next_snapshot
  FROM public.score_snapshots snapshot
  WHERE snapshot.id = p_snapshot_id
    AND snapshot.contest_id = p_contest_id;

  IF NOT FOUND OR next_snapshot.validation_status <> 'accepted' THEN
    RETURN false;
  END IF;

  IF next_snapshot.source_mode = 'automatic' THEN
    IF state_row.scoring_mode = 'manual'
      OR next_snapshot.authority_generation IS NULL
      OR next_snapshot.refresh_sequence IS NULL
      OR next_snapshot.refresh_started_at IS NULL
      OR next_snapshot.authority_generation <> state_row.authority_generation
      OR next_snapshot.refresh_sequence <> state_row.latest_refresh_sequence
      OR next_snapshot.refresh_sequence <= state_row.promoted_refresh_sequence
    THEN
      RETURN false;
    END IF;

    SELECT *
      INTO lease_row
    FROM public.score_refresh_leases lease
    WHERE lease.contest_id = p_contest_id
      AND lease.authority_generation = next_snapshot.authority_generation
      AND lease.refresh_sequence = next_snapshot.refresh_sequence
    FOR UPDATE;

    IF NOT FOUND OR lease_row.requested_at <> next_snapshot.refresh_started_at THEN
      RETURN false;
    END IF;
  ELSIF state_row.scoring_mode <> 'manual' THEN
    RETURN false;
  END IF;

  UPDATE public.score_snapshots snapshot
  SET is_current = false
  WHERE snapshot.contest_id = p_contest_id
    AND snapshot.is_current;

  UPDATE public.score_snapshots snapshot
  SET is_current = true
  WHERE snapshot.id = p_snapshot_id;

  UPDATE public.contest_score_state state
  SET
    current_snapshot_id = p_snapshot_id,
    promoted_refresh_sequence = CASE
      WHEN next_snapshot.source_mode = 'automatic'
        THEN next_snapshot.refresh_sequence
      ELSE state.promoted_refresh_sequence
    END,
    revision = state.revision + 1,
    updated_at = clock_timestamp()
  WHERE state.contest_id = p_contest_id;

  public_score := jsonb_build_object(
    'leftScore', next_snapshot.side_score,
    'topScore', next_snapshot.top_score,
    'quarterScores', next_snapshot.quarter_scores,
    'clock', coalesce(next_snapshot.clock, ''),
    'period', next_snapshot.period,
    'state', next_snapshot.game_state,
    'detail', coalesce(next_snapshot.detail, ''),
    'isOvertime', next_snapshot.period > 4,
    'isManual', next_snapshot.source_mode = 'manual',
    'sourceName', coalesce(
      next_snapshot.source_name,
      CASE
        WHEN next_snapshot.source_mode = 'manual' THEN 'Organizer'
        ELSE 'Automatic beta'
      END
    ),
    'sourceUrl', next_snapshot.source_url,
    'sourceObservedAt', next_snapshot.source_observed_at,
    'retrievedAt', next_snapshot.retrieved_at,
    'staleAfter', next_snapshot.stale_after,
    'freshness', 'fresh'
  );

  UPDATE public.public_board_snapshots snapshot
  SET
    score = public_score,
    updated_at = clock_timestamp()
  WHERE snapshot.contest_id = p_contest_id;
  GET DIAGNOSTICS projected_rows = ROW_COUNT;

  IF current_contest.published_at IS NOT NULL AND projected_rows <> 1 THEN
    RAISE EXCEPTION 'Published score projection is unavailable';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_promote_score_snapshot(
  uuid,
  uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_promote_score_snapshot(
  uuid,
  uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.gridone_enable_manual_scoring(
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
  state_row public.contest_score_state%ROWTYPE;
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

  INSERT INTO public.contest_score_state (contest_id)
  VALUES (p_contest_id)
  ON CONFLICT (contest_id) DO NOTHING;

  SELECT *
    INTO state_row
  FROM public.contest_score_state state
  WHERE state.contest_id = p_contest_id
  FOR UPDATE;

  IF state_row.scoring_mode = 'manual' THEN
    RETURN true;
  END IF;

  UPDATE public.score_snapshots snapshot
  SET is_current = false
  WHERE snapshot.contest_id = p_contest_id
    AND snapshot.is_current;

  UPDATE public.contest_score_state state
  SET
    scoring_mode = 'manual',
    current_snapshot_id = NULL,
    authority_generation = state.authority_generation + 1,
    manual_mode_started_at = p_changed_at,
    manual_mode_started_by = p_owner_id,
    revision = state.revision + 1,
    updated_at = p_changed_at
  WHERE state.contest_id = p_contest_id;

  UPDATE public.public_board_snapshots snapshot
  SET
    score = NULL,
    updated_at = p_changed_at
  WHERE snapshot.contest_id = p_contest_id;

  INSERT INTO public.contest_audit_events (
    contest_id,
    actor_id,
    event_type,
    details
  )
  VALUES (
    p_contest_id,
    p_owner_id,
    'score.manual_enabled',
    '{}'::jsonb
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_enable_manual_scoring(
  uuid,
  uuid,
  timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_enable_manual_scoring(
  uuid,
  uuid,
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
  state_row public.contest_score_state%ROWTYPE;
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
  VALUES (p_contest_id)
  ON CONFLICT (contest_id) DO NOTHING;

  SELECT *
    INTO state_row
  FROM public.contest_score_state state
  WHERE state.contest_id = p_contest_id
  FOR UPDATE;

  IF state_row.scoring_mode = 'automatic' THEN
    RETURN true;
  END IF;

  UPDATE public.score_snapshots snapshot
  SET is_current = false
  WHERE snapshot.contest_id = p_contest_id
    AND snapshot.is_current;

  UPDATE public.contest_score_state state
  SET
    scoring_mode = 'automatic',
    current_snapshot_id = NULL,
    authority_generation = state.authority_generation + 1,
    manual_mode_started_at = NULL,
    manual_mode_started_by = NULL,
    revision = state.revision + 1,
    updated_at = p_changed_at
  WHERE state.contest_id = p_contest_id;

  INSERT INTO public.contest_audit_events (
    contest_id,
    actor_id,
    event_type,
    details
  )
  VALUES (
    p_contest_id,
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
