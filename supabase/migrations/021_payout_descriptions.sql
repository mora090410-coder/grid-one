-- Organizer-authored, viewer-visible payout descriptions. These values are
-- display-only text: GridOne never computes, collects, holds, or pays money.

CREATE OR REPLACE FUNCTION public.gridone_valid_payout_descriptions(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN jsonb_typeof(value) IS DISTINCT FROM 'object' THEN false
    ELSE
      NOT EXISTS (
        SELECT 1
        FROM jsonb_object_keys(value) AS key(name)
        WHERE key.name NOT IN ('Q1', 'HALF', 'Q3', 'FINAL', 'notes')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_each(value) AS field(key, field_value)
        WHERE jsonb_typeof(field.field_value) <> 'string'
          OR char_length(field.field_value #>> '{}') > CASE
            WHEN field.key = 'notes' THEN 280
            ELSE 120
          END
          OR (field.field_value #>> '{}') ~* 'https?://'
      )
  END;
$$;

REVOKE ALL ON FUNCTION public.gridone_valid_payout_descriptions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gridone_valid_payout_descriptions(jsonb)
  TO authenticated, service_role;

ALTER TABLE public.contests
  ADD COLUMN payout_descriptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT contests_payout_descriptions_check
    CHECK (public.gridone_valid_payout_descriptions(payout_descriptions));

ALTER TABLE public.public_board_snapshots
  ADD COLUMN payout_descriptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT public_board_snapshots_payout_descriptions_check
    CHECK (public.gridone_valid_payout_descriptions(payout_descriptions));

-- The publish RPC reads the contest row and creates the snapshot in one
-- transaction. Hydrate this new projection on insert without duplicating the
-- large, pricing-sensitive gridone_publish_board function from migration 019.
CREATE OR REPLACE FUNCTION public.gridone_project_snapshot_payout_descriptions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  SELECT contest.payout_descriptions
    INTO NEW.payout_descriptions
  FROM public.contests contest
  WHERE contest.id = NEW.contest_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout descriptions require an existing board';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_project_snapshot_payout_descriptions()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER gridone_project_snapshot_payout_descriptions
  BEFORE INSERT ON public.public_board_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.gridone_project_snapshot_payout_descriptions();

CREATE OR REPLACE FUNCTION public.gridone_update_payout_descriptions(
  p_contest_id uuid,
  p_owner_id uuid,
  p_expected_revision bigint,
  p_payout_descriptions jsonb
)
RETURNS TABLE (
  contest_id uuid,
  next_revision bigint,
  contest_updated_at timestamptz,
  payout_descriptions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_contest public.contests%ROWTYPE;
  updated_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.gridone_valid_payout_descriptions(p_payout_descriptions) THEN
    RAISE EXCEPTION 'Invalid payout descriptions';
  END IF;

  SELECT contest.*
    INTO current_contest
  FROM public.contests contest
  WHERE contest.id = p_contest_id
    AND contest.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND OR current_contest.revision <> p_expected_revision THEN
    RETURN;
  END IF;

  UPDATE public.contests contest
  SET payout_descriptions = p_payout_descriptions
  WHERE contest.id = current_contest.id
    AND contest.revision = p_expected_revision
  RETURNING contest.* INTO updated_contest;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.public_board_snapshots snapshot
  SET
    revision = updated_contest.revision,
    payout_descriptions = updated_contest.payout_descriptions,
    updated_at = updated_contest.updated_at
  WHERE snapshot.contest_id = updated_contest.id;

  RETURN QUERY SELECT
    updated_contest.id,
    updated_contest.revision,
    updated_contest.updated_at,
    updated_contest.payout_descriptions;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_update_payout_descriptions(
  uuid,
  uuid,
  bigint,
  jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_update_payout_descriptions(
  uuid,
  uuid,
  bigint,
  jsonb
) TO service_role;
