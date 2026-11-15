-- Recover/create only the public seller link belonging to a valid private
-- family capability. No organizer authority, link rotation or board edits.
BEGIN;

CREATE FUNCTION public.gridone_family_seller_link(p_token_hash text, p_action text DEFAULT 'read')
-- Service role already has table grants and bypasses RLS; no definer escalation.
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  target_id uuid;
  board public.contests%ROWTYPE;
  access_row public.family_board_access%ROWTYPE;
  link public.seller_links%ROWTYPE;
  scope_cells integer[];
  available_count integer;
  result_state text;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
    OR p_action IS NULL OR p_action NOT IN ('read','create') THEN
    RAISE EXCEPTION 'family_invalid_request';
  END IF;
  -- Identity only; authority is rechecked after the canonical board lock.
  SELECT contest_id INTO target_id FROM public.family_board_access WHERE token_hash=p_token_hash;
  IF target_id IS NULL THEN RAISE EXCEPTION 'family_access_denied'; END IF;
  SELECT * INTO board FROM public.contests WHERE id=target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'family_access_denied'; END IF;
  SELECT * INTO access_row FROM public.family_board_access
    WHERE token_hash=p_token_hash AND contest_id=board.id FOR UPDATE;
  IF NOT FOUND OR access_row.revoked_at IS NOT NULL OR access_row.expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'family_access_denied';
  END IF;
  SELECT array_agg((idx-1)::integer ORDER BY idx) INTO scope_cells
    FROM jsonb_array_elements_text(board.board_data->'allocationLabels') WITH ORDINALITY labels(value,idx)
    WHERE value=access_row.label;
  -- A seller link follows its whole current label. A subset capability must
  -- never acquire a broader link, including after an organizer reassignment.
  IF scope_cells IS NULL OR cardinality(scope_cells)<>cardinality(access_row.cells)
    OR NOT (scope_cells @> access_row.cells AND scope_cells <@ access_row.cells) THEN
    RAISE EXCEPTION 'family_access_denied';
  END IF;
  SELECT count(*)::integer INTO available_count FROM unnest(scope_cells) cell
    WHERE (board.board_data->'squares'->cell=jsonb_build_array(access_row.label)
      OR (board.board_data->'squares'->cell='[]'::jsonb AND board.board_data->'availability'->>cell='available'))
      AND board.board_data->'availability'->>cell IS DISTINCT FROM 'unavailable';
  SELECT * INTO link FROM public.seller_links
    WHERE contest_id=board.id AND label=access_row.label AND revoked_at IS NULL FOR UPDATE;
  IF board.shared_at IS NULL THEN result_state := 'not_shared';
  ELSIF board.published_at IS NOT NULL OR board.axis_locked_at IS NOT NULL
    OR board.status NOT IN ('draft','reconciling','ready') THEN result_state := 'locked';
  ELSIF available_count=0 THEN result_state := 'no_available';
  ELSIF link.id IS NOT NULL THEN result_state := 'active';
  ELSIF p_action='read' THEN result_state := 'not_created';
  ELSE
    INSERT INTO public.seller_links(contest_id,label,code)
      VALUES(board.id,access_row.label,substr(md5(gen_random_uuid()::text || clock_timestamp()::text),1,16))
      RETURNING * INTO link;
    INSERT INTO public.contest_audit_events(contest_id,actor_id,event_type,previous_revision,next_revision,details)
      VALUES(board.id,NULL,'family.seller_link_created',board.revision,board.revision,
        jsonb_build_object('familyAccessId',access_row.id,'linkId',link.id));
    result_state := 'active';
  END IF;
  RETURN jsonb_build_object('state',result_state,'availableCount',available_count)
    || CASE WHEN result_state='active' THEN jsonb_build_object('code',link.code) ELSE '{}'::jsonb END;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_family_seller_link(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_family_seller_link(text,text) TO service_role;

COMMIT;
