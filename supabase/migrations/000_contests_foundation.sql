-- GridOne canonical root table.
--
-- This migration intentionally sorts before the legacy migrations. The original
-- chain began by referencing public.contests without ever creating it, so a
-- clean database could not be reproduced.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.gridone_generate_share_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = pg_catalog, public
AS $$
  SELECT string_agg(
    substr(
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      1 + (
        get_byte(
          uuid_send(gen_random_uuid()),
          character_position - 1
        ) % 32
      ),
      1
    ),
    '' ORDER BY character_position
  )
  FROM generate_series(1, 8) AS characters(character_position);
$$;

REVOKE ALL ON FUNCTION public.gridone_generate_share_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gridone_generate_share_code() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_code text NOT NULL DEFAULT public.gridone_generate_share_code(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reconciling', 'ready', 'published', 'live', 'final', 'archived')),
  season_year smallint NOT NULL DEFAULT 2026 CHECK (season_year BETWEEN 2026 AND 2100),
  sport text NOT NULL DEFAULT 'nfl' CHECK (sport = 'nfl'),
  game_external_id text,
  game_starts_at timestamptz,
  side_team_name text,
  side_team_abbr text,
  top_team_name text,
  top_team_abbr text,
  side_axis smallint[],
  top_axis smallint[],
  axis_locked_at timestamptz,
  axis_locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payout_labels jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(payout_labels) = 'object'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Temporary compatibility fields for the pre-greenfield application. They
  -- remain organizer-only and are removed after the normalized APIs cut over.
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  board_data jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT contests_share_code_format
    CHECK (share_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  CONSTRAINT contests_share_code_key UNIQUE (share_code),
  CONSTRAINT contests_side_axis_shape CHECK (
    side_axis IS NULL OR (
      cardinality(side_axis) = 10
      AND side_axis <@ ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[]
      AND ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[] <@ side_axis
    )
  ),
  CONSTRAINT contests_top_axis_shape CHECK (
    top_axis IS NULL OR (
      cardinality(top_axis) = 10
      AND top_axis <@ ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[]
      AND ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[] <@ top_axis
    )
  ),
  CONSTRAINT contests_axis_pair CHECK (
    (side_axis IS NULL AND top_axis IS NULL)
    OR (side_axis IS NOT NULL AND top_axis IS NOT NULL)
  ),
  CONSTRAINT contests_axis_lock_shape CHECK (
    axis_locked_at IS NULL
    OR (side_axis IS NOT NULL AND top_axis IS NOT NULL)
  ),
  CONSTRAINT contests_publish_shape CHECK (
    published_at IS NULL
    OR (axis_locked_at IS NOT NULL AND status IN ('published', 'live', 'final', 'archived'))
  )
);

CREATE INDEX IF NOT EXISTS contests_owner_id_idx
  ON public.contests (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS contests_game_starts_at_idx
  ON public.contests (game_starts_at)
  WHERE status IN ('published', 'live');

CREATE OR REPLACE FUNCTION public.gridone_touch_contest()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_touch_contest() FROM PUBLIC;

DROP TRIGGER IF EXISTS gridone_touch_contest ON public.contests;
CREATE TRIGGER gridone_touch_contest
  BEFORE UPDATE ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.gridone_touch_contest();

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
