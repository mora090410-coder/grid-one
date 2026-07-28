-- Serialize score-provider refreshes so many viewers collapse into one request.

CREATE OR REPLACE FUNCTION public.gridone_acquire_score_refresh_lease(
  p_contest_id uuid,
  p_lease_token uuid,
  p_seconds integer DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  acquired_token uuid;
BEGIN
  INSERT INTO public.score_refresh_leases (contest_id, lease_token, locked_until, requested_at)
  VALUES (
    p_contest_id,
    p_lease_token,
    now() + make_interval(secs => greatest(5, least(p_seconds, 120))),
    now()
  )
  ON CONFLICT (contest_id) DO UPDATE
    SET lease_token = EXCLUDED.lease_token,
        locked_until = EXCLUDED.locked_until,
        requested_at = EXCLUDED.requested_at
    WHERE public.score_refresh_leases.locked_until <= now()
  RETURNING lease_token INTO acquired_token;

  RETURN acquired_token = p_lease_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.gridone_release_score_refresh_lease(
  p_contest_id uuid,
  p_lease_token uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  DELETE FROM public.score_refresh_leases
  WHERE contest_id = p_contest_id
    AND lease_token = p_lease_token;
$$;

REVOKE ALL ON FUNCTION public.gridone_acquire_score_refresh_lease(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gridone_release_score_refresh_lease(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gridone_acquire_score_refresh_lease(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gridone_release_score_refresh_lease(uuid, uuid) TO service_role;
