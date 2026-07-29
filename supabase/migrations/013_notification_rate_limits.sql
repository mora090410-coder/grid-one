-- Durable notification abuse controls and an atomic one-current-address
-- lifecycle. Public handlers may expose only the generic accepted/throttled
-- contract; detailed outcomes remain service-role-only forensic data.

ALTER TABLE public.notification_subscriptions
  DROP CONSTRAINT IF EXISTS notification_subscriptions_status_check;

ALTER TABLE public.notification_subscriptions
  ADD CONSTRAINT notification_subscriptions_status_check
  CHECK (
    status IN (
      'pending',
      'verified',
      'unsubscribed',
      'bounced',
      'replaced',
      'expired'
    )
  ),
  ADD COLUMN replaced_at timestamptz,
  ADD COLUMN replaced_by_subscription_id uuid
    REFERENCES public.notification_subscriptions(id) ON DELETE SET NULL;

-- The original schema allowed more than one verified address for a participant.
-- Preserve the most recently verified row and make the invariant enforceable.
WITH ranked_verified AS (
  SELECT
    subscription.id,
    first_value(subscription.id) OVER (
      PARTITION BY subscription.contest_id, subscription.participant_id
      ORDER BY
        subscription.verified_at DESC NULLS LAST,
        subscription.updated_at DESC,
        subscription.id DESC
    ) AS keeper_id,
    row_number() OVER (
      PARTITION BY subscription.contest_id, subscription.participant_id
      ORDER BY
        subscription.verified_at DESC NULLS LAST,
        subscription.updated_at DESC,
        subscription.id DESC
    ) AS position
  FROM public.notification_subscriptions subscription
  WHERE subscription.status = 'verified'
)
UPDATE public.notification_subscriptions subscription
SET
  status = 'replaced',
  replaced_at = now(),
  replaced_by_subscription_id = ranked_verified.keeper_id,
  updated_at = now()
FROM ranked_verified
WHERE subscription.id = ranked_verified.id
  AND ranked_verified.position > 1;

CREATE UNIQUE INDEX notification_subscriptions_one_verified
  ON public.notification_subscriptions (contest_id, participant_id)
  WHERE status = 'verified';

-- Migration 005 combined the table-name check with a field access in one
-- expression. PostgreSQL still resolves that field against the triggering row,
-- so notification inserts fail because they have no current_snapshot_id.
-- Keep each table-specific field access inside its selected branch.
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
    IF NOT EXISTS (
      SELECT 1 FROM public.score_snapshots snapshot
      WHERE snapshot.id = NEW.score_snapshot_id
        AND snapshot.contest_id = NEW.contest_id
        AND snapshot.validation_status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Resolution score snapshot does not belong to this contest';
    END IF;

    IF NEW.assignment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.square_assignments assignment
      WHERE assignment.id = NEW.assignment_id
        AND assignment.contest_id = NEW.contest_id
        AND (NEW.participant_id IS NULL OR assignment.participant_id = NEW.participant_id)
    ) THEN
      RAISE EXCEPTION 'Resolution assignment does not belong to this contest';
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

CREATE TABLE public.notification_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  requested_participant_id uuid NOT NULL,
  participant_id uuid REFERENCES public.contest_participants(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.notification_subscriptions(id) ON DELETE SET NULL,
  address_hash text NOT NULL CHECK (address_hash ~ '^[a-f0-9]{64}$'),
  client_ip inet NOT NULL,
  claim_outcome text NOT NULL CHECK (
    claim_outcome IN (
      'claimed',
      'already_verified',
      'invalid_participant',
      'throttled_board',
      'throttled_address',
      'throttled_ip',
      'throttled_participant'
    )
  ),
  counts_toward_ip_limit boolean NOT NULL DEFAULT true,
  retry_after_seconds integer CHECK (retry_after_seconds IS NULL OR retry_after_seconds > 0),
  delivery_outcome text CHECK (delivery_outcome IN ('sent', 'provider_failed')),
  provider_status smallint CHECK (
    provider_status IS NULL OR provider_status BETWEEN 100 AND 599
  ),
  provider_message_id text CHECK (char_length(provider_message_id) <= 255),
  last_error text CHECK (char_length(last_error) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX notification_send_log_board_window_idx
  ON public.notification_send_log (contest_id, created_at DESC)
  WHERE claim_outcome = 'claimed';

CREATE INDEX notification_send_log_address_window_idx
  ON public.notification_send_log (address_hash, created_at DESC)
  WHERE claim_outcome = 'claimed';

CREATE INDEX notification_send_log_ip_window_idx
  ON public.notification_send_log (client_ip, created_at DESC)
  WHERE counts_toward_ip_limit;

CREATE INDEX notification_send_log_participant_window_idx
  ON public.notification_send_log (contest_id, participant_id, created_at DESC);

ALTER TABLE public.notification_send_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_send_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.notification_send_log TO service_role;

CREATE OR REPLACE FUNCTION public.gridone_claim_notification_send(
  p_contest_id uuid,
  p_requested_participant_id uuid,
  p_email text,
  p_address_hash text,
  p_client_ip inet,
  p_verification_token_hash text,
  p_unsubscribe_token_hash text
)
RETURNS TABLE (
  claim_id uuid,
  should_send boolean,
  is_throttled boolean,
  retry_after_seconds integer,
  subscription_id uuid,
  participant_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  request_time timestamptz := clock_timestamp();
  normalized_email text := lower(btrim(p_email));
  lock_key bigint;
  oldest_event timestamptz;
  event_count integer;
  retry_seconds integer;
  selected_participant public.contest_participants%ROWTYPE;
  selected_subscription public.notification_subscriptions%ROWTYPE;
  selected_subscription_id uuid;
  selected_claim_id uuid;
  active_pending_count integer;
BEGIN
  IF normalized_email IS NULL
    OR char_length(normalized_email) NOT BETWEEN 3 AND 320
    OR p_address_hash !~ '^[a-f0-9]{64}$'
    OR p_verification_token_hash !~ '^[a-f0-9]{64}$'
    OR p_unsubscribe_token_hash !~ '^[a-f0-9]{64}$'
  THEN
    RAISE EXCEPTION 'Invalid notification claim input';
  END IF;

  -- Acquire every affected dimension in a stable order. This makes rolling
  -- counts and the participant pending-address cap safe under concurrency.
  FOR lock_key IN
    SELECT DISTINCT requested_lock.key
    FROM unnest(ARRAY[
      hashtextextended('notification:board:' || p_contest_id::text, 0),
      hashtextextended('notification:address:' || p_address_hash, 0),
      hashtextextended('notification:ip:' || p_client_ip::text, 0),
      hashtextextended(
        'notification:participant:' || p_contest_id::text || ':' || p_requested_participant_id::text,
        0
      )
    ]) AS requested_lock(key)
    ORDER BY requested_lock.key
  LOOP
    PERFORM pg_advisory_xact_lock(lock_key);
  END LOOP;

  SELECT count(*), min(log.created_at)
  INTO event_count, oldest_event
  FROM public.notification_send_log log
  WHERE log.client_ip = p_client_ip
    AND log.counts_toward_ip_limit
    AND log.created_at > request_time - interval '10 minutes';

  IF event_count >= 5 THEN
    retry_seconds := greatest(
      1,
      ceil(extract(epoch FROM (oldest_event + interval '10 minutes' - request_time)))::integer
    );
    INSERT INTO public.notification_send_log (
      contest_id,
      requested_participant_id,
      address_hash,
      client_ip,
      claim_outcome,
      counts_toward_ip_limit,
      retry_after_seconds
    )
    VALUES (
      p_contest_id,
      p_requested_participant_id,
      p_address_hash,
      p_client_ip,
      'throttled_ip',
      false,
      retry_seconds
    );
    RETURN QUERY SELECT
      NULL::uuid,
      false,
      true,
      retry_seconds,
      NULL::uuid,
      NULL::text;
    RETURN;
  END IF;

  SELECT participant.*
  INTO selected_participant
  FROM public.contest_participants participant
  JOIN public.public_board_snapshots snapshot
    ON snapshot.contest_id = participant.contest_id
   AND snapshot.withdrawn_at IS NULL
  WHERE participant.id = p_requested_participant_id
    AND participant.contest_id = p_contest_id;

  IF NOT FOUND THEN
    INSERT INTO public.notification_send_log (
      contest_id,
      requested_participant_id,
      address_hash,
      client_ip,
      claim_outcome
    )
    VALUES (
      p_contest_id,
      p_requested_participant_id,
      p_address_hash,
      p_client_ip,
      'invalid_participant'
    );
    RETURN QUERY SELECT
      NULL::uuid,
      false,
      false,
      NULL::integer,
      NULL::uuid,
      NULL::text;
    RETURN;
  END IF;

  UPDATE public.notification_subscriptions subscription
  SET
    status = 'expired',
    verification_token_hash = NULL,
    updated_at = request_time
  WHERE subscription.contest_id = p_contest_id
    AND subscription.participant_id = p_requested_participant_id
    AND subscription.status = 'pending'
    AND subscription.verification_sent_at <= request_time - interval '24 hours';

  SELECT subscription.*
  INTO selected_subscription
  FROM public.notification_subscriptions subscription
  WHERE subscription.contest_id = p_contest_id
    AND subscription.participant_id = p_requested_participant_id
    AND lower(subscription.email) = normalized_email
  FOR UPDATE;

  IF FOUND AND selected_subscription.status = 'verified' THEN
    INSERT INTO public.notification_send_log (
      contest_id,
      requested_participant_id,
      participant_id,
      subscription_id,
      address_hash,
      client_ip,
      claim_outcome
    )
    VALUES (
      p_contest_id,
      p_requested_participant_id,
      selected_participant.id,
      selected_subscription.id,
      p_address_hash,
      p_client_ip,
      'already_verified'
    );
    RETURN QUERY SELECT
      NULL::uuid,
      false,
      false,
      NULL::integer,
      selected_subscription.id,
      selected_participant.display_name;
    RETURN;
  END IF;

  IF selected_subscription.id IS NULL OR selected_subscription.status <> 'pending' THEN
    SELECT count(*), min(subscription.verification_sent_at)
    INTO active_pending_count, oldest_event
    FROM public.notification_subscriptions subscription
    WHERE subscription.contest_id = p_contest_id
      AND subscription.participant_id = p_requested_participant_id
      AND subscription.status = 'pending'
      AND subscription.verification_sent_at > request_time - interval '24 hours';

    IF active_pending_count >= 2 THEN
      retry_seconds := greatest(
        1,
        ceil(extract(epoch FROM (oldest_event + interval '24 hours' - request_time)))::integer
      );
      INSERT INTO public.notification_send_log (
        contest_id,
        requested_participant_id,
        participant_id,
        address_hash,
        client_ip,
        claim_outcome,
        retry_after_seconds
      )
      VALUES (
        p_contest_id,
        p_requested_participant_id,
        selected_participant.id,
        p_address_hash,
        p_client_ip,
        'throttled_participant',
        retry_seconds
      );
      RETURN QUERY SELECT
        NULL::uuid,
        false,
        true,
        retry_seconds,
        NULL::uuid,
        selected_participant.display_name;
      RETURN;
    END IF;
  END IF;

  SELECT count(*), min(log.created_at)
  INTO event_count, oldest_event
  FROM public.notification_send_log log
  WHERE log.contest_id = p_contest_id
    AND log.claim_outcome = 'claimed'
    AND log.created_at > request_time - interval '1 hour';

  IF event_count >= 10 THEN
    retry_seconds := greatest(
      1,
      ceil(extract(epoch FROM (oldest_event + interval '1 hour' - request_time)))::integer
    );
    INSERT INTO public.notification_send_log (
      contest_id,
      requested_participant_id,
      participant_id,
      address_hash,
      client_ip,
      claim_outcome,
      retry_after_seconds
    )
    VALUES (
      p_contest_id,
      p_requested_participant_id,
      selected_participant.id,
      p_address_hash,
      p_client_ip,
      'throttled_board',
      retry_seconds
    );
    RETURN QUERY SELECT
      NULL::uuid,
      false,
      true,
      retry_seconds,
      NULL::uuid,
      selected_participant.display_name;
    RETURN;
  END IF;

  SELECT count(*), min(log.created_at)
  INTO event_count, oldest_event
  FROM public.notification_send_log log
  WHERE log.address_hash = p_address_hash
    AND log.claim_outcome = 'claimed'
    AND log.created_at > request_time - interval '24 hours';

  IF event_count >= 3 THEN
    retry_seconds := greatest(
      1,
      ceil(extract(epoch FROM (oldest_event + interval '24 hours' - request_time)))::integer
    );
    INSERT INTO public.notification_send_log (
      contest_id,
      requested_participant_id,
      participant_id,
      address_hash,
      client_ip,
      claim_outcome,
      retry_after_seconds
    )
    VALUES (
      p_contest_id,
      p_requested_participant_id,
      selected_participant.id,
      p_address_hash,
      p_client_ip,
      'throttled_address',
      retry_seconds
    );
    RETURN QUERY SELECT
      NULL::uuid,
      false,
      true,
      retry_seconds,
      NULL::uuid,
      selected_participant.display_name;
    RETURN;
  END IF;

  IF selected_subscription.id IS NULL THEN
    INSERT INTO public.notification_subscriptions (
      contest_id,
      participant_id,
      email,
      status,
      verification_token_hash,
      unsubscribe_token_hash,
      verification_sent_at,
      verified_at,
      unsubscribed_at,
      replaced_at,
      replaced_by_subscription_id,
      updated_at
    )
    VALUES (
      p_contest_id,
      p_requested_participant_id,
      normalized_email,
      'pending',
      p_verification_token_hash,
      p_unsubscribe_token_hash,
      request_time,
      NULL,
      NULL,
      NULL,
      NULL,
      request_time
    )
    RETURNING id INTO selected_subscription_id;
  ELSE
    UPDATE public.notification_subscriptions subscription
    SET
      email = normalized_email,
      status = 'pending',
      verification_token_hash = p_verification_token_hash,
      unsubscribe_token_hash = p_unsubscribe_token_hash,
      verification_sent_at = request_time,
      verified_at = NULL,
      unsubscribed_at = NULL,
      replaced_at = NULL,
      replaced_by_subscription_id = NULL,
      updated_at = request_time
    WHERE subscription.id = selected_subscription.id
    RETURNING subscription.id INTO selected_subscription_id;
  END IF;

  INSERT INTO public.notification_send_log (
    contest_id,
    requested_participant_id,
    participant_id,
    subscription_id,
    address_hash,
    client_ip,
    claim_outcome
  )
  VALUES (
    p_contest_id,
    p_requested_participant_id,
    selected_participant.id,
    selected_subscription_id,
    p_address_hash,
    p_client_ip,
    'claimed'
  )
  RETURNING id INTO selected_claim_id;

  RETURN QUERY SELECT
    selected_claim_id,
    true,
    false,
    NULL::integer,
    selected_subscription_id,
    selected_participant.display_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.gridone_complete_notification_send(
  p_claim_id uuid,
  p_outcome text,
  p_provider_status integer DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_outcome NOT IN ('sent', 'provider_failed') THEN
    RAISE EXCEPTION 'Invalid notification delivery outcome';
  END IF;

  UPDATE public.notification_send_log log
  SET
    delivery_outcome = p_outcome,
    provider_status = p_provider_status,
    provider_message_id = left(p_provider_message_id, 255),
    last_error = left(p_error, 1000),
    completed_at = clock_timestamp()
  WHERE log.id = p_claim_id
    AND log.claim_outcome = 'claimed'
    AND log.delivery_outcome IS NULL;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.gridone_verify_notification_subscription(
  p_subscription_id uuid,
  p_verification_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  verification_time timestamptz := clock_timestamp();
  target_contest_id uuid;
  target_participant_id uuid;
  target_subscription public.notification_subscriptions%ROWTYPE;
BEGIN
  SELECT subscription.contest_id, subscription.participant_id
  INTO target_contest_id, target_participant_id
  FROM public.notification_subscriptions subscription
  WHERE subscription.id = p_subscription_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'notification:participant:' || target_contest_id::text || ':' || target_participant_id::text,
    0
  ));

  SELECT subscription.*
  INTO target_subscription
  FROM public.notification_subscriptions subscription
  WHERE subscription.id = p_subscription_id
    AND subscription.status = 'pending'
    AND subscription.verification_token_hash = p_verification_token_hash
    AND subscription.verification_sent_at > verification_time - interval '24 hours'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.notification_subscriptions subscription
  SET
    status = 'replaced',
    replaced_at = verification_time,
    replaced_by_subscription_id = target_subscription.id,
    updated_at = verification_time
  WHERE subscription.contest_id = target_subscription.contest_id
    AND subscription.participant_id = target_subscription.participant_id
    AND subscription.status = 'verified'
    AND subscription.id <> target_subscription.id;

  UPDATE public.notification_subscriptions subscription
  SET
    status = 'verified',
    verified_at = verification_time,
    verification_token_hash = NULL,
    unsubscribed_at = NULL,
    replaced_at = NULL,
    replaced_by_subscription_id = NULL,
    updated_at = verification_time
  WHERE subscription.id = target_subscription.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_claim_notification_send(
  uuid,
  uuid,
  text,
  text,
  inet,
  text,
  text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gridone_complete_notification_send(
  uuid,
  text,
  integer,
  text,
  text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gridone_verify_notification_subscription(
  uuid,
  text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gridone_claim_notification_send(
  uuid,
  uuid,
  text,
  text,
  inet,
  text,
  text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.gridone_complete_notification_send(
  uuid,
  text,
  integer,
  text,
  text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.gridone_verify_notification_subscription(
  uuid,
  text
) TO service_role;
