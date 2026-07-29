-- Bind contests to a canonical NFL event and protect that identity after
-- publication. Existing unlinked contests remain valid for legacy reads and
-- manual scoring.

CREATE OR REPLACE FUNCTION public.gridone_protect_published_game_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL
    AND (
      NEW.season_year IS DISTINCT FROM OLD.season_year
      OR NEW.sport IS DISTINCT FROM OLD.sport
      OR NEW.game_external_id IS DISTINCT FROM OLD.game_external_id
      OR NEW.game_starts_at IS DISTINCT FROM OLD.game_starts_at
      OR NEW.side_team_name IS DISTINCT FROM OLD.side_team_name
      OR NEW.side_team_abbr IS DISTINCT FROM OLD.side_team_abbr
      OR NEW.top_team_name IS DISTINCT FROM OLD.top_team_name
      OR NEW.top_team_abbr IS DISTINCT FROM OLD.top_team_abbr
      OR NEW.settings -> 'gameExternalId' IS DISTINCT FROM OLD.settings -> 'gameExternalId'
      OR NEW.settings -> 'gameStartsAt' IS DISTINCT FROM OLD.settings -> 'gameStartsAt'
      OR NEW.settings -> 'kickoffAt' IS DISTINCT FROM OLD.settings -> 'kickoffAt'
      OR NEW.settings -> 'dates' IS DISTINCT FROM OLD.settings -> 'dates'
      OR NEW.settings -> 'leftName' IS DISTINCT FROM OLD.settings -> 'leftName'
      OR NEW.settings -> 'leftAbbr' IS DISTINCT FROM OLD.settings -> 'leftAbbr'
      OR NEW.settings -> 'topName' IS DISTINCT FROM OLD.settings -> 'topName'
      OR NEW.settings -> 'topAbbr' IS DISTINCT FROM OLD.settings -> 'topAbbr'
    )
  THEN
    RAISE EXCEPTION 'Published game identity is locked';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_protect_published_game_identity()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gridone_protect_published_game_identity ON public.contests;
CREATE TRIGGER gridone_protect_published_game_identity
  BEFORE UPDATE OF
    season_year,
    sport,
    game_external_id,
    game_starts_at,
    side_team_name,
    side_team_abbr,
    top_team_name,
    top_team_abbr,
    settings
  ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.gridone_protect_published_game_identity();

-- Update a selected game, its compatibility document, and optional board data
-- under one row lock. If the event identity changes, every score derived from
-- the former event is removed in the same transaction.
CREATE OR REPLACE FUNCTION public.gridone_update_draft_matchup(
  p_contest_id uuid,
  p_owner_id uuid,
  p_expected_revision bigint,
  p_game_external_id text,
  p_game_starts_at timestamptz,
  p_season_year smallint,
  p_side_team_name text,
  p_side_team_abbr text,
  p_top_team_name text,
  p_top_team_abbr text,
  p_title text,
  p_payout_labels jsonb,
  p_settings jsonb,
  p_update_board boolean DEFAULT false,
  p_board_data jsonb DEFAULT NULL
)
RETURNS TABLE (
  contest_id uuid,
  next_revision bigint,
  contest_updated_at timestamptz,
  matchup_changed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_contest public.contests%ROWTYPE;
  updated_contest public.contests%ROWTYPE;
  identity_changed boolean;
  next_settings jsonb;
BEGIN
  SELECT *
    INTO current_contest
  FROM public.contests c
  WHERE c.id = p_contest_id
    AND c.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF current_contest.revision <> p_expected_revision THEN
    RETURN;
  END IF;

  identity_changed :=
    current_contest.game_external_id IS DISTINCT FROM p_game_external_id
    OR current_contest.game_starts_at IS DISTINCT FROM p_game_starts_at
    OR current_contest.season_year IS DISTINCT FROM p_season_year
    OR current_contest.side_team_name IS DISTINCT FROM p_side_team_name
    OR current_contest.side_team_abbr IS DISTINCT FROM p_side_team_abbr
    OR current_contest.top_team_name IS DISTINCT FROM p_top_team_name
    OR current_contest.top_team_abbr IS DISTINCT FROM p_top_team_abbr;

  IF identity_changed
    AND (
      current_contest.published_at IS NOT NULL
      OR current_contest.status NOT IN ('draft', 'reconciling', 'ready')
    )
  THEN
    RAISE EXCEPTION 'Published game identity is locked';
  END IF;

  next_settings := p_settings;
  IF identity_changed THEN
    next_settings := next_settings
      - 'useManualScores'
      - 'manualLeftScore'
      - 'manualTopScore'
      - 'manualQuarterScores'
      - 'manualPeriod'
      - 'manualGameState'
      - 'scoreSnapshot';
  END IF;

  UPDATE public.contests c
  SET
    game_external_id = p_game_external_id,
    game_starts_at = p_game_starts_at,
    season_year = p_season_year,
    sport = 'nfl',
    side_team_name = p_side_team_name,
    side_team_abbr = p_side_team_abbr,
    top_team_name = p_top_team_name,
    top_team_abbr = p_top_team_abbr,
    title = btrim(p_title),
    payout_labels = p_payout_labels,
    settings = next_settings,
    board_data = CASE WHEN p_update_board THEN p_board_data ELSE c.board_data END
  WHERE c.id = current_contest.id
    AND c.revision = p_expected_revision
  RETURNING c.* INTO updated_contest;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF identity_changed THEN
    DELETE FROM public.milestone_resolutions
    WHERE milestone_resolutions.contest_id = current_contest.id;

    DELETE FROM public.score_refresh_leases
    WHERE score_refresh_leases.contest_id = current_contest.id;

    DELETE FROM public.score_snapshots
    WHERE score_snapshots.contest_id = current_contest.id;

    DELETE FROM public.contest_score_state
    WHERE contest_score_state.contest_id = current_contest.id;

    INSERT INTO public.contest_audit_events (
      contest_id,
      actor_id,
      event_type,
      previous_revision,
      next_revision,
      details
    )
    VALUES (
      current_contest.id,
      p_owner_id,
      'game.matchup_changed',
      current_contest.revision,
      updated_contest.revision,
      jsonb_build_object(
        'previous_game_external_id', current_contest.game_external_id,
        'next_game_external_id', p_game_external_id
      )
    );
  END IF;

  IF current_contest.published_at IS NOT NULL THEN
    UPDATE public.public_board_snapshots
    SET
      revision = updated_contest.revision,
      board_title = updated_contest.title,
      payout_labels = updated_contest.payout_labels,
      updated_at = now()
    WHERE public_board_snapshots.contest_id = current_contest.id;
  END IF;

  RETURN QUERY SELECT
    updated_contest.id,
    updated_contest.revision,
    updated_contest.updated_at,
    identity_changed;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_update_draft_matchup(
  uuid,
  uuid,
  bigint,
  text,
  timestamptz,
  smallint,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  boolean,
  jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_update_draft_matchup(
  uuid,
  uuid,
  bigint,
  text,
  timestamptz,
  smallint,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  boolean,
  jsonb
) TO service_role;
