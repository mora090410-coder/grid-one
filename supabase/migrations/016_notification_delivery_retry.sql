-- Bound winner-notification retries and move retry authority into an atomic,
-- service-role-only queue. Provider calls happen outside PostgreSQL; a short
-- lease and the existing deterministic idempotency key make crashed workers
-- safe to reclaim.

ALTER TABLE public.notification_deliveries
  DROP CONSTRAINT IF EXISTS notification_deliveries_status_check;

ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS notification_kind text NOT NULL DEFAULT 'winner',
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_class text,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS terminal_at timestamptz;

-- Normalize any pre-migration delivery state before validating the new queue
-- invariants. Existing in-flight sends keep a five-minute recovery lease.
UPDATE public.notification_deliveries delivery
SET
  attempt_count = least(delivery.attempt_count, 5),
  status = CASE
    WHEN delivery.status IN ('pending', 'failed') AND delivery.attempt_count >= 5
      THEN 'failed_permanent'
    ELSE delivery.status
  END,
  failure_class = CASE
    WHEN delivery.status IN ('pending', 'failed') AND delivery.attempt_count >= 5
      THEN 'transient'
    ELSE NULL
  END,
  next_attempt_at = CASE
    WHEN delivery.status = 'failed' AND delivery.attempt_count < 5
      THEN greatest(
        coalesce(delivery.last_attempted_at, delivery.created_at),
        clock_timestamp()
      )
    ELSE NULL
  END,
  lease_token = CASE
    WHEN delivery.status = 'sending' THEN gen_random_uuid()
    ELSE NULL
  END,
  lease_expires_at = CASE
    WHEN delivery.status = 'sending'
      THEN coalesce(delivery.last_attempted_at, delivery.created_at)
        + interval '5 minutes'
    ELSE NULL
  END,
  terminal_at = CASE
    WHEN delivery.status IN ('sent', 'skipped')
      OR (
        delivery.status IN ('pending', 'failed')
        AND delivery.attempt_count >= 5
      )
      THEN coalesce(
        delivery.sent_at,
        delivery.last_attempted_at,
        delivery.created_at,
        clock_timestamp()
      )
    ELSE NULL
  END;

ALTER TABLE public.notification_deliveries
  ADD CONSTRAINT notification_deliveries_status_check
    CHECK (status IN (
      'pending',
      'sending',
      'sent',
      'failed',
      'failed_permanent',
      'skipped'
    )),
  ADD CONSTRAINT notification_deliveries_attempt_limit_check
    CHECK (attempt_count BETWEEN 0 AND 5),
  ADD CONSTRAINT notification_deliveries_failure_class_check
    CHECK (failure_class IS NULL OR failure_class IN ('transient', 'permanent')),
  ADD CONSTRAINT notification_deliveries_retry_state_check
    CHECK (
      (status = 'failed' AND next_attempt_at IS NOT NULL AND attempt_count < 5)
      OR
      (status = 'pending' AND next_attempt_at IS NULL AND attempt_count < 5)
      OR
      (
        status NOT IN ('pending', 'failed')
        AND next_attempt_at IS NULL
      )
    ),
  ADD CONSTRAINT notification_deliveries_lease_state_check
    CHECK (
      (
        status = 'sending'
        AND lease_token IS NOT NULL
        AND lease_expires_at IS NOT NULL
      )
      OR
      (
        status <> 'sending'
        AND lease_token IS NULL
        AND lease_expires_at IS NULL
      )
    ),
  ADD CONSTRAINT notification_deliveries_terminal_state_check
    CHECK (
      (
        status IN ('sent', 'failed_permanent', 'skipped')
        AND terminal_at IS NOT NULL
      )
      OR
      (
        status NOT IN ('sent', 'failed_permanent', 'skipped')
        AND terminal_at IS NULL
      )
    );

CREATE INDEX notification_deliveries_retry_due_idx
  ON public.notification_deliveries (next_attempt_at, created_at)
  WHERE status = 'failed' AND attempt_count < 5;

CREATE INDEX notification_deliveries_pending_idx
  ON public.notification_deliveries (created_at)
  WHERE status = 'pending';

CREATE INDEX notification_deliveries_expired_lease_idx
  ON public.notification_deliveries (lease_expires_at)
  WHERE status = 'sending';

CREATE OR REPLACE FUNCTION public.gridone_claim_notification_deliveries(
  p_limit integer DEFAULT 20,
  p_lease_seconds integer DEFAULT 120,
  p_now timestamptz DEFAULT clock_timestamp()
)
RETURNS TABLE (
  delivery_id uuid,
  lease_token uuid,
  idempotency_key text,
  notification_kind text,
  attempt_count smallint,
  recipient_email text,
  subscription_id uuid,
  milestone text,
  side_digit smallint,
  top_digit smallint,
  participant_name text,
  board_title text,
  share_code text,
  side_team text,
  top_team text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- A worker that crashes after making the fifth provider request must not
  -- leave the row permanently "sending" or permit a sixth request.
  UPDATE public.notification_deliveries delivery
  SET
    status = 'failed_permanent',
    failure_class = 'transient',
    next_attempt_at = NULL,
    lease_token = NULL,
    lease_expires_at = NULL,
    last_error = coalesce(
      delivery.last_error,
      'Delivery lease expired after the fifth provider attempt'
    ),
    terminal_at = p_now
  WHERE delivery.status = 'sending'
    AND delivery.attempt_count >= 5
    AND delivery.lease_expires_at <= p_now;

  RETURN QUERY
  WITH candidates AS (
    SELECT delivery.id
    FROM public.notification_deliveries delivery
    JOIN public.notification_subscriptions subscription
      ON subscription.id = delivery.subscription_id
    WHERE subscription.status = 'verified'
      AND delivery.attempt_count < 5
      AND (
        delivery.status = 'pending'
        OR (
          delivery.status = 'failed'
          AND delivery.next_attempt_at <= p_now
        )
        OR (
          delivery.status = 'sending'
          AND delivery.lease_expires_at <= p_now
        )
      )
    ORDER BY
      coalesce(delivery.next_attempt_at, delivery.lease_expires_at, delivery.created_at),
      delivery.created_at,
      delivery.id
    FOR UPDATE OF delivery SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 20), 50))
  ),
  claimed AS (
    UPDATE public.notification_deliveries delivery
    SET
      status = 'sending',
      attempt_count = delivery.attempt_count + 1,
      last_attempted_at = p_now,
      last_error = NULL,
      failure_class = NULL,
      next_attempt_at = NULL,
      lease_token = gen_random_uuid(),
      lease_expires_at = p_now
        + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 600))),
      terminal_at = NULL
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.*
  )
  SELECT
    claimed.id,
    claimed.lease_token,
    claimed.idempotency_key,
    claimed.notification_kind,
    claimed.attempt_count,
    subscription.email,
    subscription.id,
    resolution.milestone,
    resolution.side_digit,
    resolution.top_digit,
    coalesce(participant.display_name, 'Your square'),
    contest.title,
    contest.share_code,
    coalesce(contest.side_team_abbr, contest.side_team_name, 'Side'),
    coalesce(contest.top_team_abbr, contest.top_team_name, 'Top')
  FROM claimed
  JOIN public.notification_subscriptions subscription
    ON subscription.id = claimed.subscription_id
  JOIN public.milestone_resolutions resolution
    ON resolution.id = claimed.resolution_id
  JOIN public.contests contest
    ON contest.id = resolution.contest_id
  LEFT JOIN public.contest_participants participant
    ON participant.id = resolution.participant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gridone_complete_notification_delivery(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_now timestamptz DEFAULT clock_timestamp()
)
RETURNS TABLE (
  status text,
  attempt_count smallint,
  next_attempt_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_delivery public.notification_deliveries%ROWTYPE;
  retry_at timestamptz;
  completed_status text;
BEGIN
  IF p_outcome NOT IN ('sent', 'transient', 'permanent') THEN
    RAISE EXCEPTION 'Unsupported notification delivery outcome';
  END IF;

  SELECT *
    INTO current_delivery
  FROM public.notification_deliveries delivery
  WHERE delivery.id = p_delivery_id
    AND delivery.status = 'sending'
    AND delivery.lease_token = p_lease_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_outcome = 'sent' THEN
    completed_status := 'sent';
    retry_at := NULL;
  ELSIF p_outcome = 'permanent' OR current_delivery.attempt_count >= 5 THEN
    completed_status := 'failed_permanent';
    retry_at := NULL;
  ELSE
    completed_status := 'failed';
    retry_at := p_now + CASE current_delivery.attempt_count
      WHEN 1 THEN interval '1 minute'
      WHEN 2 THEN interval '5 minutes'
      WHEN 3 THEN interval '25 minutes'
      WHEN 4 THEN interval '2 hours'
      ELSE interval '2 hours'
    END;
  END IF;

  RETURN QUERY
  UPDATE public.notification_deliveries delivery
  SET
    status = completed_status,
    provider_message_id = CASE
      WHEN p_outcome = 'sent' THEN nullif(left(p_provider_message_id, 500), '')
      ELSE delivery.provider_message_id
    END,
    last_error = CASE
      WHEN p_outcome = 'sent' THEN NULL
      ELSE left(coalesce(nullif(p_error, ''), 'Email delivery failed'), 1000)
    END,
    failure_class = CASE
      WHEN p_outcome = 'sent' THEN NULL
      WHEN p_outcome = 'permanent' THEN 'permanent'
      ELSE 'transient'
    END,
    next_attempt_at = retry_at,
    lease_token = NULL,
    lease_expires_at = NULL,
    sent_at = CASE WHEN p_outcome = 'sent' THEN p_now ELSE delivery.sent_at END,
    terminal_at = CASE
      WHEN completed_status IN ('sent', 'failed_permanent') THEN p_now
      ELSE NULL
    END
  WHERE delivery.id = current_delivery.id
  RETURNING delivery.status, delivery.attempt_count, delivery.next_attempt_at;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_claim_notification_deliveries(
  integer,
  integer,
  timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_claim_notification_deliveries(
  integer,
  integer,
  timestamptz
) TO service_role;

REVOKE ALL ON FUNCTION public.gridone_complete_notification_delivery(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_complete_notification_delivery(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz
) TO service_role;
