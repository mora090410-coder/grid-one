-- Let an existing private family capability create or recover its one public
-- guest link without accepting seller identity or square scope from the caller.

CREATE FUNCTION public.gridone_family_guest_link(
  p_board_id uuid,
  p_token_hash text,
  p_action text DEFAULT 'read'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  access_identity uuid;
  board public.contests%ROWTYPE;
  access_row public.family_board_access%ROWTYPE;
  invite public.guest_invites%ROWTYPE;
  invite_found boolean := false;
  scope_cells integer[];
  result_state text;
  available_count integer := 0;
  next_revision bigint;
  result jsonb;
BEGIN
  IF p_board_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
    OR p_action IS NULL OR p_action NOT IN ('read','create')
  THEN
    RAISE EXCEPTION 'family_invalid_request';
  END IF;

  -- This first lookup establishes identity only. Authority is rechecked after
  -- locking the caller-named canonical board.
  SELECT access.contest_id INTO access_identity
  FROM public.family_board_access access
  WHERE access.token_hash=p_token_hash;
  IF access_identity IS NULL OR access_identity IS DISTINCT FROM p_board_id THEN
    RAISE EXCEPTION 'family_access_denied';
  END IF;

  SELECT contest.* INTO board
  FROM public.contests contest
  WHERE contest.id=p_board_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'family_access_denied'; END IF;

  SELECT access.* INTO access_row
  FROM public.family_board_access access
  WHERE access.token_hash=p_token_hash AND access.contest_id=board.id
  FOR UPDATE;
  IF NOT FOUND OR access_row.revoked_at IS NOT NULL OR access_row.expires_at<=clock_timestamp()
    OR EXISTS (
      SELECT 1 FROM unnest(access_row.cells) cell
      WHERE board.board_data->'allocationLabels'->>cell IS DISTINCT FROM access_row.label
    )
  THEN
    RAISE EXCEPTION 'family_access_denied';
  END IF;

  SELECT array_agg(cell ORDER BY cell) INTO scope_cells
  FROM unnest(access_row.cells) cell;

  -- Prefer the currently enabled record when historical disabled links share a
  -- seller label. An enabled expired link is still canonical and cannot be
  -- bypassed by creating a replacement.
  SELECT current_invite.* INTO invite
  FROM public.guest_invites current_invite
  WHERE current_invite.contest_id=board.id
    AND lower(current_invite.seller_label)=lower(access_row.label)
  ORDER BY (current_invite.disabled_at IS NULL) DESC,current_invite.created_at DESC,current_invite.id
  LIMIT 1
  FOR UPDATE;
  invite_found := FOUND;

  IF invite_found AND NOT (
    cardinality(invite.cells)=cardinality(scope_cells)
    AND invite.cells @> scope_cells
    AND invite.cells <@ scope_cells
  ) THEN
    result_state := 'scope_mismatch';
  ELSIF invite_found AND invite.disabled_at IS NOT NULL THEN
    result_state := 'disabled';
  ELSIF invite_found AND invite.expires_at IS NOT NULL AND invite.expires_at<=clock_timestamp() THEN
    result_state := 'expired';
  ELSIF board.shared_at IS NULL THEN
    result_state := 'not_shared';
  ELSIF board.published_at IS NOT NULL OR board.axis_locked_at IS NOT NULL
    OR board.status NOT IN ('draft','reconciling','ready')
    OR board.board_data->'isDynamic'='true'::jsonb
  THEN
    result_state := 'locked';
  ELSIF invite_found THEN
    result_state := 'active';
  ELSIF p_action='read' THEN
    result_state := 'not_created';
  ELSE
    INSERT INTO public.guest_invites(contest_id,seller_label,cells,max_squares,expires_at,payment)
    VALUES(board.id,access_row.label,scope_cells,1,NULL,NULL)
    RETURNING * INTO invite;
    invite_found := true;
    UPDATE public.contests SET updated_at=clock_timestamp()
    WHERE id=board.id RETURNING revision INTO next_revision;
    INSERT INTO public.contest_audit_events(
      contest_id,actor_id,event_type,entity_type,entity_id,previous_revision,next_revision,details
    ) VALUES(
      board.id,NULL,'family.guest_link_created','guest_invite',invite.id,
      board.revision,next_revision,
      jsonb_build_object('familyAccessId',access_row.id,'label',access_row.label,'cells',scope_cells)
    );
    PERFORM public.gridone_guest_emit(board.id,'family.guest_link_created',next_revision);
    board.revision := next_revision;
    result_state := 'active';
  END IF;

  SELECT count(*)::integer INTO available_count
  FROM unnest(scope_cells) cell
  WHERE coalesce(board.board_data->'availability'->>cell,'unspecified')='available'
    AND NOT EXISTS (
      SELECT 1 FROM public.guest_square_claims claim
      WHERE claim.contest_id=board.id AND claim.cell_index=cell AND claim.released_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.guest_square_holds hold
      WHERE hold.contest_id=board.id AND hold.cell_index=cell AND hold.expires_at>clock_timestamp()
    );

  result := jsonb_build_object(
    'boardId',board.id,
    'title',board.title,
    'label',access_row.label,
    'cells',scope_cells,
    'revision',coalesce(next_revision,board.revision),
    'state',result_state,
    'availableCount',available_count
  );
  IF invite_found THEN
    result := result || jsonb_build_object(
      'inviteId',invite.id,
      'version',invite.credential_version,
      'maxSquares',invite.max_squares
    );
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_family_guest_link(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_family_guest_link(uuid,text,text) TO service_role;
