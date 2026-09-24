-- Client events are kept for 13 months (Anthony, 2026-09-24): long enough to
-- compare one football season with the next, no longer.
-- The notification retry cron calls this once an hour through the service role.
CREATE INDEX client_events_received_idx ON public.client_events(received_at);

CREATE FUNCTION public.gridone_prune_client_events()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH removed AS (
    DELETE FROM public.client_events
    WHERE received_at < now() - interval '13 months'
    RETURNING 1
  )
  SELECT count(*)::integer FROM removed;
$$;
REVOKE ALL ON FUNCTION public.gridone_prune_client_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_prune_client_events() TO service_role;
