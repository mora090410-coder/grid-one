-- Confirm automatic quarter results only after two stable provider observations,
-- retain corrections as append-only versions, and publish a viewer-safe
-- pending/history projection.

ALTER TABLE public.public_board_snapshots
  ADD COLUMN pending_milestones jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(pending_milestones) = 'array');

CREATE TABLE public.pending_resolutions (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  milestone text NOT NULL CHECK (milestone IN ('Q1', 'Q2', 'Q3', 'FINAL')),
  candidate_side_score smallint NOT NULL CHECK (candidate_side_score BETWEEN 0 AND 255),
  candidate_top_score smallint NOT NULL CHECK (candidate_top_score BETWEEN 0 AND 255),
  first_snapshot_id uuid NOT NULL REFERENCES public.score_snapshots(id) ON DELETE CASCADE,
  latest_snapshot_id uuid NOT NULL REFERENCES public.score_snapshots(id) ON DELETE CASCADE,
  stable_since timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  successful_read_count integer NOT NULL DEFAULT 1 CHECK (successful_read_count > 0),
  PRIMARY KEY (contest_id, milestone),
  CONSTRAINT pending_resolution_observation_order
    CHECK (last_observed_at >= stable_since)
);

ALTER TABLE public.pending_resolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pending_resolutions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.pending_resolutions TO service_role;

ALTER TABLE public.milestone_resolutions
  ADD COLUMN side_score smallint,
  ADD COLUMN top_score smallint,
  ADD COLUMN resolution_version integer NOT NULL DEFAULT 1,
  ADD COLUMN supersedes_resolution_id uuid
    REFERENCES public.milestone_resolutions(id) ON DELETE RESTRICT,
  ADD COLUMN corrected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.milestone_resolutions resolution
SET
  side_score = CASE resolution.milestone
    WHEN 'Q1' THEN coalesce((snapshot.quarter_scores -> 'Q1' ->> 'left')::integer, 0)
    WHEN 'Q2' THEN
      coalesce((snapshot.quarter_scores -> 'Q1' ->> 'left')::integer, 0)
      + coalesce((snapshot.quarter_scores -> 'Q2' ->> 'left')::integer, 0)
    WHEN 'Q3' THEN
      coalesce((snapshot.quarter_scores -> 'Q1' ->> 'left')::integer, 0)
      + coalesce((snapshot.quarter_scores -> 'Q2' ->> 'left')::integer, 0)
      + coalesce((snapshot.quarter_scores -> 'Q3' ->> 'left')::integer, 0)
    ELSE snapshot.side_score
  END,
  top_score = CASE resolution.milestone
    WHEN 'Q1' THEN coalesce((snapshot.quarter_scores -> 'Q1' ->> 'top')::integer, 0)
    WHEN 'Q2' THEN
      coalesce((snapshot.quarter_scores -> 'Q1' ->> 'top')::integer, 0)
      + coalesce((snapshot.quarter_scores -> 'Q2' ->> 'top')::integer, 0)
    WHEN 'Q3' THEN
      coalesce((snapshot.quarter_scores -> 'Q1' ->> 'top')::integer, 0)
      + coalesce((snapshot.quarter_scores -> 'Q2' ->> 'top')::integer, 0)
      + coalesce((snapshot.quarter_scores -> 'Q3' ->> 'top')::integer, 0)
    ELSE snapshot.top_score
  END
FROM public.score_snapshots snapshot
WHERE snapshot.id = resolution.score_snapshot_id;

ALTER TABLE public.milestone_resolutions
  ALTER COLUMN side_score SET NOT NULL,
  ALTER COLUMN top_score SET NOT NULL,
  ALTER COLUMN score_snapshot_id DROP NOT NULL,
  DROP CONSTRAINT milestone_resolutions_key,
  ADD CONSTRAINT milestone_resolutions_score_range
    CHECK (side_score BETWEEN 0 AND 255 AND top_score BETWEEN 0 AND 255),
  ADD CONSTRAINT milestone_resolutions_digit_match
    CHECK (side_digit = side_score % 10 AND top_digit = top_score % 10),
  ADD CONSTRAINT milestone_resolutions_version_positive
    CHECK (resolution_version > 0),
  ADD CONSTRAINT milestone_resolutions_version_shape
    CHECK (
      (
        resolution_version = 1
        AND supersedes_resolution_id IS NULL
        AND score_snapshot_id IS NOT NULL
      )
      OR
      (
        resolution_version > 1
        AND supersedes_resolution_id IS NOT NULL
        AND score_snapshot_id IS NULL
        AND corrected_by IS NOT NULL
        AND corrected_at IS NOT NULL
        AND char_length(btrim(correction_reason)) BETWEEN 3 AND 500
      )
    ),
  ADD CONSTRAINT milestone_resolutions_version_key
    UNIQUE (contest_id, milestone, resolution_version);

CREATE UNIQUE INDEX milestone_resolutions_supersedes_key
  ON public.milestone_resolutions (supersedes_resolution_id)
  WHERE supersedes_resolution_id IS NOT NULL;

ALTER TABLE public.notification_deliveries
  ADD COLUMN notification_kind text NOT NULL DEFAULT 'winner',
  DROP CONSTRAINT notification_deliveries_once_key,
  ADD CONSTRAINT notification_deliveries_kind_check
    CHECK (
      notification_kind IN (
        'winner',
        'correction_previous',
        'correction_current'
      )
    ),
  ADD CONSTRAINT notification_deliveries_once_per_kind_key
    UNIQUE (resolution_id, subscription_id, notification_kind);

-- Migration 013 repaired table-specific trigger dispatch. Corrections add one
-- intentional exception: only append-only correction versions may omit the
-- provider/manual snapshot that established the original result.
CREATE OR REPLACE FUNCTION public.gridone_validate_contest_children()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'public_board_snapshots' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contests contest
      WHERE contest.id = NEW.contest_id
        AND contest.share_code = NEW.share_code
        AND contest.published_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Public snapshot does not match a published contest';
    END IF;
  ELSIF TG_TABLE_NAME = 'contest_score_state' THEN
    IF NEW.current_snapshot_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.score_snapshots snapshot
      WHERE snapshot.id = NEW.current_snapshot_id
        AND snapshot.contest_id = NEW.contest_id
        AND snapshot.validation_status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Current score snapshot does not belong to this contest';
    END IF;
  ELSIF TG_TABLE_NAME = 'milestone_resolutions' THEN
    IF NEW.score_snapshot_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.score_snapshots snapshot
      WHERE snapshot.id = NEW.score_snapshot_id
        AND snapshot.contest_id = NEW.contest_id
        AND snapshot.validation_status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Resolution score snapshot does not belong to this contest';
    END IF;

    IF NEW.score_snapshot_id IS NULL AND NEW.resolution_version = 1 THEN
      RAISE EXCEPTION 'Initial resolution requires an accepted score snapshot';
    END IF;

    IF NEW.supersedes_resolution_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.milestone_resolutions previous_resolution
      WHERE previous_resolution.id = NEW.supersedes_resolution_id
        AND previous_resolution.contest_id = NEW.contest_id
        AND previous_resolution.milestone = NEW.milestone
        AND previous_resolution.resolution_version = NEW.resolution_version - 1
    ) THEN
      RAISE EXCEPTION 'Superseded resolution is not the prior milestone version';
    END IF;

    IF NEW.assignment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.square_assignments assignment
      WHERE assignment.id = NEW.assignment_id
        AND assignment.contest_id = NEW.contest_id
        AND (NEW.participant_id IS NULL OR assignment.participant_id = NEW.participant_id)
    ) THEN
      RAISE EXCEPTION 'Resolution assignment does not belong to this contest';
    END IF;

    IF NEW.participant_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.contest_participants participant
      WHERE participant.id = NEW.participant_id
        AND participant.contest_id = NEW.contest_id
    ) THEN
      RAISE EXCEPTION 'Resolution participant does not belong to this contest';
    END IF;
  ELSIF TG_TABLE_NAME = 'notification_subscriptions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contest_participants participant
      WHERE participant.id = NEW.participant_id
        AND participant.contest_id = NEW.contest_id
    ) THEN
      RAISE EXCEPTION 'Notification identity does not belong to this contest';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
  WHERE snapshot.contest_id = p_contest_id;

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
    WHERE subscription.contest_id = p_contest_id
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

REVOKE ALL ON FUNCTION public.gridone_observe_milestones(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_observe_milestones(uuid, uuid)
TO service_role;

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
      'sideScore', p_side_score,
      'topScore', p_top_score,
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
