-- Published board assignments and number axes are immutable. Score snapshots,
-- notification subscriptions, and winner resolutions remain independently
-- writable through their narrow server-owned paths.

CREATE OR REPLACE FUNCTION public.gridone_protect_published_board_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL
    AND NEW.board_data IS DISTINCT FROM OLD.board_data
  THEN
    RAISE EXCEPTION 'Published board assignments and number axes are locked';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_protect_published_board_data() FROM PUBLIC;

DROP TRIGGER IF EXISTS gridone_protect_published_board_data ON public.contests;
CREATE TRIGGER gridone_protect_published_board_data
  BEFORE UPDATE OF board_data ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.gridone_protect_published_board_data();
