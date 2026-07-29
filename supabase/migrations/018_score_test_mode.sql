-- Score-test boards use completed-game data for controlled demonstrations.
-- The flag is permanent, server-created only, viewer-visible, and suppresses
-- every winner/correction delivery at the queue boundary.

ALTER TABLE public.contests
  ADD COLUMN score_test_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.public_board_snapshots
  ADD COLUMN score_test_mode boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.gridone_enforce_score_test_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF TG_OP = 'INSERT'
    AND NEW.score_test_mode
    AND coalesce(auth.role(), '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'Score-test boards require the server creation boundary'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.score_test_mode IS DISTINCT FROM OLD.score_test_mode
  THEN
    RAISE EXCEPTION 'Score-test mode is immutable';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_enforce_score_test_mode() FROM PUBLIC;

CREATE TRIGGER gridone_enforce_score_test_mode
  BEFORE INSERT OR UPDATE OF score_test_mode
  ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.gridone_enforce_score_test_mode();

CREATE OR REPLACE FUNCTION public.gridone_sync_public_score_test_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  permanent_score_test_mode boolean;
BEGIN
  SELECT contest.score_test_mode
    INTO permanent_score_test_mode
  FROM public.contests contest
  WHERE contest.id = NEW.contest_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public snapshot contest does not exist';
  END IF;

  NEW.score_test_mode := permanent_score_test_mode;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_sync_public_score_test_mode() FROM PUBLIC;

CREATE TRIGGER gridone_sync_public_score_test_mode
  BEFORE INSERT OR UPDATE
  ON public.public_board_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.gridone_sync_public_score_test_mode();

CREATE OR REPLACE FUNCTION public.gridone_suppress_score_test_notification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.milestone_resolutions resolution
    JOIN public.contests contest
      ON contest.id = resolution.contest_id
    WHERE resolution.id = NEW.resolution_id
      AND contest.score_test_mode
  ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_suppress_score_test_notification() FROM PUBLIC;

CREATE TRIGGER gridone_suppress_score_test_notification
  BEFORE INSERT
  ON public.notification_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.gridone_suppress_score_test_notification();

COMMENT ON COLUMN public.contests.score_test_mode IS
  'Permanent server-created marker for completed-game synthetic score demonstrations.';

COMMENT ON COLUMN public.public_board_snapshots.score_test_mode IS
  'Viewer-safe projection of the permanent contest score-test marker.';
