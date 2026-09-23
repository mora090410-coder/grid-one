-- Seller links: one public link per seller (allocation label) on a shared board.
-- Anyone with the link can claim that seller's unsold squares by typing a name.
-- A square is unsold while its public name still equals the seller's label.
-- Scope is read from the board's current allocation at claim time, under the
-- board row lock, so reassigning squares changes what a link can claim.
-- GridOne records names only. The seller collects money outside GridOne.
CREATE TABLE public.seller_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (label = btrim(label) AND char_length(label) BETWEEN 1 AND 80),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-f0-9]{16}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
ALTER TABLE public.seller_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.seller_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.seller_links TO service_role;
CREATE UNIQUE INDEX seller_links_one_active_idx ON public.seller_links(contest_id, label) WHERE revoked_at IS NULL;

CREATE FUNCTION public.gridone_seller_link(
  p_action text, p_contest_id uuid DEFAULT NULL, p_owner_id uuid DEFAULT NULL,
  p_label text DEFAULT NULL, p_code text DEFAULT NULL, p_cells integer[] DEFAULT NULL,
  p_name text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  target_id uuid;
  board public.contests%ROWTYPE;
  link public.seller_links%ROWTYPE;
  next_board jsonb;
  next_revision bigint;
  label_value text;
  name_value text;
  cell integer;
  is_open boolean;
  links jsonb;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('sync','rotate','read','claim') THEN RAISE EXCEPTION 'seller_invalid_request'; END IF;

  IF p_action IN ('read','claim') THEN
    IF p_code IS NULL OR p_code !~ '^[a-f0-9]{16}$' THEN RAISE EXCEPTION 'seller_access_denied'; END IF;
    -- Identity only; authority is rechecked after the board lock.
    SELECT contest_id INTO target_id FROM public.seller_links WHERE code = p_code;
    IF target_id IS NULL THEN RAISE EXCEPTION 'seller_access_denied'; END IF;
  ELSE
    target_id := p_contest_id;
  END IF;

  IF p_action = 'read' THEN
    SELECT * INTO board FROM public.contests WHERE id = target_id;
  ELSE
    SELECT * INTO board FROM public.contests WHERE id = target_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'seller_access_denied'; END IF;

  IF p_action IN ('sync','rotate') AND (p_owner_id IS NULL OR p_owner_id <> board.owner_id) THEN
    RAISE EXCEPTION 'seller_access_denied';
  END IF;
  IF board.shared_at IS NULL THEN RAISE EXCEPTION 'seller_board_not_shared'; END IF;

  is_open := board.published_at IS NULL AND board.axis_locked_at IS NULL
    AND board.status IN ('draft','reconciling','ready')
    AND board.board_data->'isDynamic' IS DISTINCT FROM 'true'::jsonb;

  IF p_action IN ('read','claim') THEN
    SELECT * INTO link FROM public.seller_links WHERE code = p_code AND contest_id = target_id;
    IF NOT FOUND OR link.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'seller_access_denied'; END IF;
  END IF;

  IF p_action = 'sync' THEN
    IF NOT is_open THEN RAISE EXCEPTION 'seller_board_locked'; END IF;
    -- One active link for every seller on the board. Existing links are kept stable.
    INSERT INTO public.seller_links(contest_id, label, code)
      SELECT target_id, labels.value, substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 16)
      FROM (SELECT DISTINCT value FROM jsonb_array_elements_text(coalesce(board.board_data->'allocationLabels','[]'::jsonb))) labels
      WHERE labels.value IS NOT NULL AND labels.value <> ''
        AND NOT EXISTS (SELECT 1 FROM public.seller_links existing
          WHERE existing.contest_id = target_id AND existing.label = labels.value AND existing.revoked_at IS NULL);
  ELSIF p_action = 'rotate' THEN
    label_value := btrim(p_label);
    IF label_value IS NULL OR char_length(label_value) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'seller_invalid_request'; END IF;
    IF NOT is_open THEN RAISE EXCEPTION 'seller_board_locked'; END IF;
    UPDATE public.seller_links SET revoked_at = clock_timestamp()
      WHERE contest_id = target_id AND label = label_value AND revoked_at IS NULL;
    INSERT INTO public.seller_links(contest_id, label, code)
      VALUES (target_id, label_value, substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 16));
    INSERT INTO public.contest_audit_events(contest_id, actor_id, event_type, previous_revision, next_revision, details)
      VALUES (target_id, p_owner_id, 'seller_link_rotated', board.revision, board.revision, jsonb_build_object('label', label_value));
  ELSIF p_action = 'claim' THEN
    IF NOT is_open THEN RAISE EXCEPTION 'seller_board_locked'; END IF;
    name_value := btrim(p_name);
    IF name_value IS NULL OR char_length(name_value) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'seller_invalid_request'; END IF;
    IF p_cells IS NULL OR cardinality(p_cells) NOT BETWEEN 1 AND 10
      OR EXISTS (SELECT 1 FROM unnest(p_cells) idx WHERE idx IS NULL OR idx NOT BETWEEN 0 AND 99)
      OR (SELECT count(DISTINCT idx) FROM unnest(p_cells) idx) <> cardinality(p_cells) THEN
      RAISE EXCEPTION 'seller_invalid_request';
    END IF;
    next_board := board.board_data;
    FOREACH cell IN ARRAY p_cells LOOP
      IF next_board->'allocationLabels'->>cell IS DISTINCT FROM link.label THEN RAISE EXCEPTION 'seller_access_denied'; END IF;
      IF next_board->'squares'->cell->>0 IS DISTINCT FROM link.label
        OR next_board->'availability'->>cell = 'unavailable' THEN
        RAISE EXCEPTION 'seller_square_taken';
      END IF;
      next_board := jsonb_set(next_board, ARRAY['squares', cell::text], jsonb_build_array(name_value));
    END LOOP;
    UPDATE public.contests SET board_data = next_board WHERE id = target_id RETURNING revision INTO next_revision;
    INSERT INTO public.contest_audit_events(contest_id, actor_id, event_type, previous_revision, next_revision, details)
      VALUES (target_id, NULL, 'seller_claim', board.revision, next_revision,
        jsonb_build_object('linkId', link.id, 'label', link.label, 'cells', to_jsonb(p_cells), 'name', name_value));
    RETURN jsonb_build_object('cells', to_jsonb(p_cells), 'name', name_value, 'label', link.label, 'shareCode', board.share_code);
  END IF;

  IF p_action IN ('sync','rotate') THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('label', active.label, 'code', active.code) ORDER BY active.label), '[]'::jsonb)
      INTO links FROM public.seller_links active
      WHERE active.contest_id = target_id AND active.revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(board.board_data->'allocationLabels','[]'::jsonb)) current(value)
          WHERE current.value = active.label);
    RETURN jsonb_build_object('links', links);
  END IF;

  -- read: only public board fields plus this seller's squares.
  RETURN jsonb_build_object(
    'title', board.title,
    'label', link.label,
    'shareCode', board.share_code,
    'open', is_open,
    'sideTeamName', board.side_team_name,
    'topTeamName', board.top_team_name,
    'gameStartsAt', board.game_starts_at,
    'squarePrice', board.board_data->'participation'->>'squarePrice',
    'instructions', board.board_data->'participation'->>'instructions',
    'cells', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'index', (idx - 1)::integer,
        'available', board.board_data->'squares'->((idx - 1)::integer)->>0 IS NOT DISTINCT FROM link.label
          AND board.board_data->'availability'->>((idx - 1)::integer) IS DISTINCT FROM 'unavailable')
      ORDER BY idx)
      FROM jsonb_array_elements_text(board.board_data->'allocationLabels') WITH ORDINALITY labels(value, idx)
      WHERE labels.value = link.label), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_seller_link(text,uuid,uuid,text,text,integer[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_seller_link(text,uuid,uuid,text,text,integer[],text) TO service_role;
