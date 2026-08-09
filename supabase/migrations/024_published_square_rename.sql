-- A fundraiser board is sold in two phases: the organizer assigns a block to a
-- seller, then replaces that placeholder with the buyer's name as money comes
-- in. Migration 008 froze every square at publish time, which blocked the
-- second phase entirely and forced organizers to delay publishing until a board
-- was fully sold.
--
-- This migration reopens exactly that one operation and nothing else:
--   * axis digits stay permanently locked (they are the fairness guarantee),
--   * renames flow through one SECURITY DEFINER function, never a raw UPDATE,
--   * every change is written to an append-only log the organizer can show a
--     participant who asks why a name moved,
--   * the public viewer snapshot is updated in the same transaction so a
--     shared board never disagrees with the organizer's copy.

-- ── Append-only audit log ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contest_square_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  cell_index int NOT NULL CHECK (cell_index >= 0 AND cell_index < 100),
  previous_name text,
  new_name text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contest_square_edits_contest_idx
  ON public.contest_square_edits (contest_id, changed_at DESC);

ALTER TABLE public.contest_square_edits ENABLE ROW LEVEL SECURITY;

-- Organizers read their own history. Nobody writes directly: inserts happen
-- inside the rename function, which runs as definer.
DROP POLICY IF EXISTS "Organizer can read square edits" ON public.contest_square_edits;
CREATE POLICY "Organizer can read square edits"
  ON public.contest_square_edits FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = (
      SELECT owner_id FROM public.contests WHERE id = contest_square_edits.contest_id
    )
  );

REVOKE ALL ON TABLE public.contest_square_edits FROM anon;
GRANT SELECT ON TABLE public.contest_square_edits TO authenticated;

-- ── Narrowed publish lock ────────────────────────────────────────────────────

-- The lock now yields only to the rename function, which announces itself with
-- a transaction-local setting. A direct UPDATE from a client session never has
-- it set, so the original guarantee holds everywhere else.
CREATE OR REPLACE FUNCTION public.gridone_protect_published_board_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.published_at IS NULL
    OR NEW.board_data IS NOT DISTINCT FROM OLD.board_data
  THEN
    RETURN NEW;
  END IF;

  -- Escape hatch one, from 022: filling squares left OPEN at publish time.
  IF current_setting('gridone.published_fill_contest', true)
    IS NOT DISTINCT FROM OLD.id::text
  THEN
    RETURN NEW;
  END IF;

  -- Escape hatch two, added here: the audited seller-to-buyer rename.
  IF coalesce(current_setting('gridone.square_rename', true), '') = 'on' THEN
    -- Even on this path, only the names may move.
    IF (NEW.board_data - 'squares') IS DISTINCT FROM (OLD.board_data - 'squares') THEN
      RAISE EXCEPTION 'Published number draws are locked';
    END IF;

    IF jsonb_typeof(NEW.board_data -> 'squares') IS DISTINCT FROM 'array'
      OR jsonb_array_length(NEW.board_data -> 'squares') <> 100
    THEN
      RAISE EXCEPTION 'The board must contain exactly 100 squares';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Published board assignments and number axes are locked';
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_protect_published_board_data() FROM PUBLIC;

-- ── The one sanctioned rename path ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.gridone_rename_published_square(
  p_contest_id uuid,
  p_cell_index integer,
  p_new_name text
) RETURNS TABLE (cell_index integer, previous_name text, new_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner uuid;
  v_published timestamptz;
  v_board jsonb;
  v_previous text;
  v_next text;
  v_cell jsonb;
BEGIN
  IF p_cell_index IS NULL OR p_cell_index < 0 OR p_cell_index > 99 THEN
    RAISE EXCEPTION 'Square index must be between 0 and 99';
  END IF;

  v_next := nullif(btrim(coalesce(p_new_name, '')), '');
  IF v_next IS NOT NULL AND char_length(v_next) > 80 THEN
    RAISE EXCEPTION 'Names are limited to 80 characters';
  END IF;

  SELECT owner_id, published_at, board_data
    INTO v_owner, v_published, v_board
  FROM public.contests
  WHERE id = p_contest_id
  FOR UPDATE;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Board not found';
  END IF;
  IF v_owner IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the organizer can rename a square';
  END IF;
  IF v_published IS NULL THEN
    RAISE EXCEPTION 'Board is not published; edit it directly instead';
  END IF;

  v_previous := nullif(btrim(coalesce(v_board -> 'squares' -> p_cell_index ->> 0, '')), '');
  IF v_previous IS NOT DISTINCT FROM v_next THEN
    RETURN QUERY SELECT p_cell_index, v_previous, v_next;
    RETURN;
  END IF;

  v_cell := CASE WHEN v_next IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_next) END;

  PERFORM set_config('gridone.square_rename', 'on', true);

  UPDATE public.contests
     SET board_data = jsonb_set(board_data, ARRAY['squares', p_cell_index::text], v_cell, false),
         revision = revision + 1
   WHERE id = p_contest_id;

  -- Keep the shared viewer copy in step, or a forwarded link shows a stale name.
  UPDATE public.public_board_snapshots
     SET board = jsonb_set(board, ARRAY['squares', p_cell_index::text], v_cell, false),
         revision = revision + 1,
         updated_at = now()
   WHERE contest_id = p_contest_id;

  PERFORM set_config('gridone.square_rename', 'off', true);

  INSERT INTO public.contest_square_edits (contest_id, cell_index, previous_name, new_name, changed_by)
  VALUES (p_contest_id, p_cell_index, v_previous, v_next, (SELECT auth.uid()));

  RETURN QUERY SELECT p_cell_index, v_previous, v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_rename_published_square(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gridone_rename_published_square(uuid, integer, text) TO authenticated;
