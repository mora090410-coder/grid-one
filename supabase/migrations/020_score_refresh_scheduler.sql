-- 020_score_refresh_scheduler.sql
-- Support for the cron-driven score refresh:
--   1. scheduler_state + an atomic slot claim so a per-minute cron can honor a
--      configurable 60-90s cadence without racing overlapping ticks.
--   2. Bounded pruning of raw provider payloads so Supabase storage grows with
--      scoring events, not with polling frequency.
--   3. Indexes backing the "any boards in their game window?" early-exit query
--      and the prune scan.

CREATE TABLE IF NOT EXISTS public.scheduler_state (
  key text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 80),
  last_run_at timestamptz NOT NULL DEFAULT to_timestamp(0)
);

ALTER TABLE public.scheduler_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scheduler_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.scheduler_state TO service_role;

-- Atomically claims a scheduler slot. Returns true when at least
-- (p_interval_seconds - 5) seconds have elapsed since the last claim; the 5s
-- margin absorbs cron jitter so a 60s target does not skip alternate ticks.
CREATE OR REPLACE FUNCTION public.gridone_claim_scheduler_slot(
  p_key text,
  p_interval_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_key IS NULL OR char_length(p_key) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Scheduler key must be 1-80 characters.';
  END IF;
  IF p_interval_seconds IS NULL OR p_interval_seconds < 10 OR p_interval_seconds > 3600 THEN
    RAISE EXCEPTION 'Scheduler interval must be between 10 and 3600 seconds.';
  END IF;

  INSERT INTO public.scheduler_state AS state (key, last_run_at)
  VALUES (p_key, clock_timestamp())
  ON CONFLICT (key) DO UPDATE
    SET last_run_at = clock_timestamp()
    WHERE state.last_run_at <= clock_timestamp() - make_interval(secs => p_interval_seconds - 5);

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_claim_scheduler_slot(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_claim_scheduler_slot(text, integer)
  TO service_role;

-- Deletes the oldest raw provider payloads beyond the retention window, in
-- bounded batches so a single cron tick never runs an unbounded delete.
CREATE OR REPLACE FUNCTION public.gridone_prune_score_provider_payloads(
  p_retain_days integer DEFAULT 7,
  p_limit integer DEFAULT 200
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF p_retain_days IS NULL OR p_retain_days < 1 OR p_retain_days > 365 THEN
    RAISE EXCEPTION 'Payload retention must be between 1 and 365 days.';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'Payload prune limit must be between 1 and 1000 rows.';
  END IF;

  WITH doomed AS (
    SELECT payload.snapshot_id
    FROM public.score_provider_payloads payload
    WHERE payload.created_at < clock_timestamp() - make_interval(days => p_retain_days)
    ORDER BY payload.created_at
    LIMIT p_limit
  )
  DELETE FROM public.score_provider_payloads target
  USING doomed
  WHERE target.snapshot_id = doomed.snapshot_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_prune_score_provider_payloads(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_prune_score_provider_payloads(integer, integer)
  TO service_role;

CREATE INDEX IF NOT EXISTS score_provider_payloads_created_at_idx
  ON public.score_provider_payloads (created_at);

-- Backs the cron's off-day early exit: "any linked boards near their window?"
CREATE INDEX IF NOT EXISTS contests_game_window_idx
  ON public.contests (game_starts_at)
  WHERE game_external_id IS NOT NULL;
