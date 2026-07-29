-- Make milestone observation idempotent at the durable score-state boundary.
-- The handler still invokes observation only after a successful promotion;
-- this gate makes concurrent/replayed invocations perform the state-machine
-- work once and permanently seals completed post-game boards.

ALTER TABLE public.contest_score_state
  ADD COLUMN milestone_observed_snapshot_id uuid
    REFERENCES public.score_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN milestone_observation_count bigint NOT NULL DEFAULT 0
    CHECK (milestone_observation_count >= 0),
  ADD COLUMN milestones_finalized_at timestamptz;

-- Preserve the milestone state machine from migration 015 behind a private
-- implementation name. The public RPC below owns replay serialization.
ALTER FUNCTION public.gridone_observe_milestones(uuid, uuid)
  RENAME TO gridone_observe_milestones_unchecked;

REVOKE ALL ON FUNCTION public.gridone_observe_milestones_unchecked(uuid, uuid)
FROM PUBLIC, anon, authenticated, service_role;

-- Re-project only when viewer-visible milestone content changed. In
-- particular, an observation replay must not churn updated_at or Realtime.
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

CREATE OR REPLACE FUNCTION public.gridone_observe_milestones(
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
  current_contest public.contests%ROWTYPE;
  score_state public.contest_score_state%ROWTYPE;
  observed_snapshot public.score_snapshots%ROWTYPE;
  projected_history jsonb;
  projected_pending jsonb;
  confirmed_ids uuid[];
  is_completed_final boolean;
BEGIN
  -- Match promotion and correction lock order: contest, score state, then the
  -- milestone advisory lock acquired by the unchecked state machine.
  SELECT contest.*
  INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found';
  END IF;

  INSERT INTO public.contest_score_state (contest_id)
  VALUES (p_contest_id)
  ON CONFLICT (contest_id) DO NOTHING;

  SELECT state.*
  INTO score_state
  FROM public.contest_score_state state
  WHERE state.contest_id = p_contest_id
  FOR UPDATE;

  IF score_state.milestones_finalized_at IS NOT NULL
    OR score_state.milestone_observed_snapshot_id = p_snapshot_id
  THEN
    SELECT
      coalesce(snapshot.winner_history, '[]'::jsonb),
      coalesce(snapshot.pending_milestones, '[]'::jsonb)
    INTO projected_history, projected_pending
    FROM public.public_board_snapshots snapshot
    WHERE snapshot.contest_id = p_contest_id;

    RETURN QUERY SELECT
      coalesce(projected_history, '[]'::jsonb),
      coalesce(projected_pending, '[]'::jsonb),
      ARRAY[]::uuid[];
    RETURN;
  END IF;

  SELECT snapshot.*
  INTO observed_snapshot
  FROM public.score_snapshots snapshot
  WHERE snapshot.id = p_snapshot_id
    AND snapshot.contest_id = p_contest_id
    AND snapshot.validation_status = 'accepted'
    AND snapshot.is_current;

  IF NOT FOUND OR score_state.current_snapshot_id IS DISTINCT FROM p_snapshot_id THEN
    RAISE EXCEPTION 'Milestone observation requires the current accepted snapshot';
  END IF;

  SELECT
    observation.winner_history,
    observation.pending_milestones,
    observation.newly_confirmed_resolution_ids
  INTO projected_history, projected_pending, confirmed_ids
  FROM public.gridone_observe_milestones_unchecked(
    p_contest_id,
    p_snapshot_id
  ) observation;

  SELECT
    observed_snapshot.game_state = 'post'
    AND count(DISTINCT resolution.milestone) = 4
  INTO is_completed_final
  FROM public.milestone_resolutions resolution
  WHERE resolution.contest_id = p_contest_id;

  UPDATE public.contest_score_state state
  SET
    milestone_observed_snapshot_id = p_snapshot_id,
    milestone_observation_count = state.milestone_observation_count + 1,
    milestones_finalized_at = CASE
      WHEN is_completed_final
        THEN coalesce(state.milestones_finalized_at, clock_timestamp())
      ELSE state.milestones_finalized_at
    END,
    updated_at = clock_timestamp()
  WHERE state.contest_id = p_contest_id;

  RETURN QUERY SELECT
    coalesce(projected_history, '[]'::jsonb),
    coalesce(projected_pending, '[]'::jsonb),
    coalesce(confirmed_ids, ARRAY[]::uuid[]);
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_observe_milestones(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_observe_milestones(uuid, uuid)
TO service_role;

-- Conservatively recognize snapshots that migration 015 already observed.
-- A pending row or a snapshot-backed resolution can only exist after the
-- observation transaction completed.
UPDATE public.contest_score_state state
SET milestone_observed_snapshot_id = state.current_snapshot_id
WHERE state.current_snapshot_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.pending_resolutions pending
      WHERE pending.contest_id = state.contest_id
        AND pending.latest_snapshot_id = state.current_snapshot_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.milestone_resolutions resolution
      WHERE resolution.contest_id = state.contest_id
        AND resolution.score_snapshot_id = state.current_snapshot_id
    )
  );

-- Existing completed boards must receive the permanent skip immediately,
-- without waiting for another viewer request.
UPDATE public.contest_score_state state
SET
  milestone_observed_snapshot_id = state.current_snapshot_id,
  milestones_finalized_at = coalesce(state.milestones_finalized_at, clock_timestamp())
FROM public.score_snapshots snapshot
WHERE snapshot.id = state.current_snapshot_id
  AND snapshot.contest_id = state.contest_id
  AND snapshot.game_state = 'post'
  AND (
    SELECT count(DISTINCT resolution.milestone)
    FROM public.milestone_resolutions resolution
    WHERE resolution.contest_id = state.contest_id
  ) = 4;

-- Promotion and milestone observation now share one transaction. A projection
-- or outbox failure rolls the canonical score promotion back, so a post-game
-- fast path can never strand an unobserved FINAL.
ALTER FUNCTION public.gridone_promote_score_snapshot(uuid, uuid)
  RENAME TO gridone_promote_score_snapshot_without_milestones;

REVOKE ALL ON FUNCTION public.gridone_promote_score_snapshot_without_milestones(
  uuid,
  uuid
) FROM PUBLIC, anon, authenticated, service_role;

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
  promoted boolean;
BEGIN
  SELECT public.gridone_promote_score_snapshot_without_milestones(
    p_contest_id,
    p_snapshot_id
  )
  INTO promoted;

  IF promoted THEN
    PERFORM *
    FROM public.gridone_observe_milestones(
      p_contest_id,
      p_snapshot_id
    );
  END IF;

  RETURN promoted;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_promote_score_snapshot(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_promote_score_snapshot(uuid, uuid)
TO service_role;
