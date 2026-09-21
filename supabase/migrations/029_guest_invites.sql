-- Account-free guest claiming for explicitly offered squares. All authority is
-- resolved in one service-only transaction function and serialized by the
-- canonical contest row. Raw invite/session/code credentials are never stored.

CREATE TABLE public.guest_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  seller_label text NOT NULL CHECK (
    seller_label = btrim(seller_label) AND char_length(seller_label) BETWEEN 1 AND 80
  ),
  cells integer[] NOT NULL CHECK (
    cardinality(cells) BETWEEN 1 AND 100
    AND array_position(cells, NULL) IS NULL
    AND 0 <= ALL(cells) AND 99 >= ALL(cells)
  ),
  max_squares integer NOT NULL DEFAULT 1 CHECK (max_squares BETWEEN 1 AND 100),
  credential_version bigint NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  expires_at timestamptz,
  disabled_at timestamptz,
  payment jsonb CHECK (payment IS NULL OR jsonb_typeof(payment) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guest_invites_contest_idx ON public.guest_invites(contest_id);
CREATE UNIQUE INDEX guest_invites_active_seller_key
  ON public.guest_invites(contest_id, lower(seller_label)) WHERE disabled_at IS NULL;

CREATE TABLE public.guest_claim_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.guest_invites(id) ON DELETE CASCADE,
  session_hash text NOT NULL CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  management_hash text CHECK (management_hash IS NULL OR management_hash ~ '^[a-f0-9]{64}$'),
  claim_code_hash text CHECK (claim_code_hash IS NULL OR claim_code_hash ~ '^[a-f0-9]{64}$'),
  display_name text CHECK (
    display_name IS NULL OR (display_name = btrim(display_name) AND char_length(display_name) BETWEEN 2 AND 30)
  ),
  confirmed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_claim_groups_invite_session_key UNIQUE(invite_id, session_hash)
);

CREATE UNIQUE INDEX guest_claim_groups_management_key
  ON public.guest_claim_groups(management_hash) WHERE management_hash IS NOT NULL;
CREATE UNIQUE INDEX guest_claim_groups_code_key
  ON public.guest_claim_groups(claim_code_hash) WHERE claim_code_hash IS NOT NULL;

CREATE TABLE public.guest_square_holds (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  cell_index integer NOT NULL CHECK (cell_index BETWEEN 0 AND 99),
  invite_id uuid NOT NULL REFERENCES public.guest_invites(id) ON DELETE CASCADE,
  claim_group_id uuid NOT NULL REFERENCES public.guest_claim_groups(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(contest_id, cell_index),
  CONSTRAINT guest_square_holds_group_cell_key UNIQUE(claim_group_id, cell_index)
);

CREATE INDEX guest_square_holds_expiry_idx ON public.guest_square_holds(expires_at);

CREATE TABLE public.guest_square_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  cell_index integer NOT NULL CHECK (cell_index BETWEEN 0 AND 99),
  invite_id uuid NOT NULL REFERENCES public.guest_invites(id) ON DELETE RESTRICT,
  claim_group_id uuid NOT NULL REFERENCES public.guest_claim_groups(id) ON DELETE RESTRICT,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX guest_square_claims_active_cell_key
  ON public.guest_square_claims(contest_id, cell_index) WHERE released_at IS NULL;
CREATE INDEX guest_square_claims_group_idx
  ON public.guest_square_claims(claim_group_id, claimed_at) WHERE released_at IS NULL;

CREATE TABLE public.guest_rate_buckets (
  key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  window_seconds integer NOT NULL CHECK (window_seconds BETWEEN 1 AND 86400),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY(key_hash, window_seconds, window_started_at)
);

ALTER TABLE public.guest_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_claim_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_square_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_square_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_rate_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.guest_invites, public.guest_claim_groups,
  public.guest_square_holds, public.guest_square_claims, public.guest_rate_buckets
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guest_invites, public.guest_claim_groups,
  public.guest_square_holds, public.guest_square_claims, public.guest_rate_buckets
  TO service_role;

CREATE FUNCTION public.gridone_guest_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  bucket_start timestamptz;
  next_count integer;
BEGIN
  IF p_key IS NULL OR p_key !~ '^[a-f0-9]{64}$'
    OR p_limit NOT BETWEEN 1 AND 10000
    OR p_window_seconds NOT BETWEEN 1 AND 86400
  THEN
    RAISE EXCEPTION 'guest_invalid_request';
  END IF;

  bucket_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );
  INSERT INTO public.guest_rate_buckets(key_hash, window_seconds, window_started_at, request_count)
  VALUES(p_key, p_window_seconds, bucket_start, 1)
  ON CONFLICT(key_hash, window_seconds, window_started_at) DO UPDATE
    SET request_count = public.guest_rate_buckets.request_count + 1
  RETURNING request_count INTO next_count;

  DELETE FROM public.guest_rate_buckets
  WHERE window_started_at < clock_timestamp() - interval '2 days';
  RETURN next_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_guest_rate_limit(text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_guest_rate_limit(text,integer,integer) TO service_role;

-- Every board writer passes this relational check. Guest operations first
-- update normalized claim/hold rows, then patch board_data; no spoofable GUC
-- or caller-supplied bypass participates in authorization.
CREATE FUNCTION public.gridone_protect_guest_occupancy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  idx integer;
  claimant_name text;
  old_square jsonb;
  new_square jsonb;
  old_availability text;
  new_availability text;
  old_allocation jsonb;
  new_allocation jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.guest_invites invite WHERE invite.contest_id = OLD.id) THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'guest_square_conflict';
  END IF;

  IF OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.guest_square_holds hold
      WHERE hold.contest_id = OLD.id AND hold.expires_at > clock_timestamp()
    )
  THEN
    RAISE EXCEPTION 'guest_holds_active';
  END IF;

  -- Published corrections continue through the existing audited rename/fill
  -- paths. Guest mutations are already closed at publication.
  IF OLD.published_at IS NOT NULL OR NEW.board_data IS NOT DISTINCT FROM OLD.board_data THEN
    RETURN NEW;
  END IF;

  FOR idx IN 0..99 LOOP
    old_square := OLD.board_data->'squares'->idx;
    new_square := NEW.board_data->'squares'->idx;
    old_availability := coalesce(OLD.board_data->'availability'->>idx, 'unspecified');
    new_availability := coalesce(NEW.board_data->'availability'->>idx, 'unspecified');
    old_allocation := OLD.board_data->'allocationLabels'->idx;
    new_allocation := NEW.board_data->'allocationLabels'->idx;

    IF old_allocation IS DISTINCT FROM new_allocation AND EXISTS (
      SELECT 1 FROM public.guest_square_holds hold
      WHERE hold.contest_id=OLD.id AND hold.cell_index=idx AND hold.expires_at > clock_timestamp()
      UNION ALL
      SELECT 1 FROM public.guest_square_claims claim
      WHERE claim.contest_id=OLD.id AND claim.cell_index=idx AND claim.released_at IS NULL
    ) THEN
      RAISE EXCEPTION 'guest_square_conflict';
    END IF;

    IF old_square IS DISTINCT FROM new_square OR old_availability IS DISTINCT FROM new_availability THEN
      SELECT groups.display_name INTO claimant_name
      FROM public.guest_square_claims claim
      JOIN public.guest_claim_groups groups ON groups.id=claim.claim_group_id
      WHERE claim.contest_id=OLD.id AND claim.cell_index=idx AND claim.released_at IS NULL;

      IF claimant_name IS NOT NULL THEN
        IF new_square IS DISTINCT FROM jsonb_build_array(claimant_name)
          OR new_availability IS DISTINCT FROM 'unavailable'
        THEN
          RAISE EXCEPTION 'guest_square_conflict';
        END IF;
      ELSIF EXISTS (
        SELECT 1 FROM public.guest_square_holds hold
        WHERE hold.contest_id=OLD.id AND hold.cell_index=idx AND hold.expires_at > clock_timestamp()
      ) THEN
        RAISE EXCEPTION 'guest_square_conflict';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_protect_guest_occupancy() FROM PUBLIC;
CREATE TRIGGER gridone_protect_guest_occupancy
  BEFORE UPDATE OF board_data, owner_id, published_at ON public.contests
  FOR EACH ROW EXECUTE FUNCTION public.gridone_protect_guest_occupancy();

-- Once responsibility changes without live occupancy, the old distributor
-- authority is no longer valid. Confirmed claims would have blocked the write.
CREATE FUNCTION public.gridone_revoke_changed_guest_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE revoked_count integer;
BEGIN
  IF NEW.board_data->'allocationLabels' IS DISTINCT FROM OLD.board_data->'allocationLabels' THEN
    UPDATE public.guest_invites invite SET disabled_at=clock_timestamp(), updated_at=clock_timestamp()
    WHERE invite.contest_id=NEW.id AND invite.disabled_at IS NULL
      AND EXISTS (SELECT 1 FROM unnest(invite.cells) cell
        WHERE NEW.board_data->'allocationLabels'->cell
          IS DISTINCT FROM OLD.board_data->'allocationLabels'->cell);
    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    DELETE FROM public.guest_square_holds hold USING public.guest_invites invite
    WHERE hold.invite_id=invite.id AND invite.contest_id=NEW.id AND invite.disabled_at IS NOT NULL;
    IF revoked_count>0 THEN
      INSERT INTO public.contest_audit_events(contest_id,actor_id,event_type,entity_type,
        previous_revision,next_revision,details)
      VALUES(NEW.id,(SELECT auth.uid()),'guest.invite_scope_revoked','guest_invite',
        OLD.revision,NEW.revision,jsonb_build_object('inviteCount',revoked_count));
      PERFORM public.gridone_guest_emit(NEW.id,'guest.invite_scope_revoked',NEW.revision);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_revoke_changed_guest_invites() FROM PUBLIC;
CREATE TRIGGER gridone_revoke_changed_guest_invites
  AFTER UPDATE OF board_data ON public.contests
  FOR EACH ROW EXECUTE FUNCTION public.gridone_revoke_changed_guest_invites();

-- Participating boards cannot publish a caller-constructed name array that is
-- different from the canonical contest. Legacy boards without invites retain
-- their current behavior.
CREATE FUNCTION public.gridone_validate_guest_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE canonical_squares jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.guest_invites invite WHERE invite.contest_id=NEW.contest_id) THEN
    SELECT board_data->'squares' INTO canonical_squares
    FROM public.contests WHERE id=NEW.contest_id;
    IF NEW.board->'squares' IS DISTINCT FROM canonical_squares THEN
      RAISE EXCEPTION 'guest_snapshot_conflict';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_validate_guest_snapshot() FROM PUBLIC;
CREATE TRIGGER gridone_validate_guest_snapshot
  BEFORE INSERT OR UPDATE OF board ON public.public_board_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.gridone_validate_guest_snapshot();

CREATE FUNCTION public.gridone_guest_emit(p_board_id uuid, p_reason text, p_revision bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  payload jsonb;
  broadcast_event text;
BEGIN
  payload := jsonb_build_object('reason',p_reason,'revision',p_revision);
  broadcast_event := CASE
    WHEN p_reason IN ('guest.hold_changed') THEN 'squares.held'
    WHEN p_reason IN ('guest.hold_released','guest.holds_cancelled','guest.claim_released') THEN 'squares.released'
    WHEN p_reason IN ('guest.claim_confirmed','guest.claim_swapped') THEN 'squares.claimed'
    ELSE 'invites.changed'
  END;
  -- Supabase provides realtime.send; disposable vanilla Postgres does not.
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    EXECUTE 'SELECT realtime.send($1,$2,$3,$4)'
      USING payload, broadcast_event, 'pool:'||p_board_id::text, false;
  END IF;
  PERFORM pg_notify('gridone_guest_events',
    jsonb_build_object('topic','pool:'||p_board_id::text,'event',broadcast_event,'payload',payload)::text);
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_guest_emit(uuid,text,bigint) FROM PUBLIC;

CREATE FUNCTION public.gridone_guest_action(
  p_action text,
  p_board_id uuid,
  p_owner_id uuid DEFAULT NULL,
  p_invite_id uuid DEFAULT NULL,
  p_guest_hash text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  board public.contests%ROWTYPE;
  invite public.guest_invites%ROWTYPE;
  claim_group public.guest_claim_groups%ROWTYPE;
  changed_claim public.guest_square_claims%ROWTYPE;
  requested_cells integer[];
  current_cells integer[];
  desired_cells integer[];
  cell integer;
  expected_revision bigint;
  next_revision bigint;
  invite_active boolean;
  payment_value jsonb;
  next_board jsonb;
  name_value text;
  credential_kind text;
  active_claim_count integer;
  hold_deadline timestamptz;
  active_release_cells integer[];
  result jsonb;
  event_name text;
  affected_count integer := 0;
BEGIN
  IF p_action IS NULL OR p_action NOT IN (
    'owner_list','owner_create','owner_update','owner_disable','owner_rotate',
    'owner_cancel_holds','owner_release_claim','owner_rotate_code',
    'guest_read','guest_hold','guest_confirm','guest_receipt','guest_release','guest_swap','public_state'
  ) OR p_board_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'guest_invalid_request';
  END IF;

  SELECT contest.* INTO board FROM public.contests contest
  WHERE contest.id=p_board_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest_access_denied'; END IF;

  DELETE FROM public.guest_square_holds hold
  WHERE hold.contest_id=p_board_id AND hold.expires_at <= clock_timestamp();
  DELETE FROM public.guest_square_holds hold USING public.guest_invites stale_invite
  WHERE hold.invite_id=stale_invite.id AND stale_invite.contest_id=p_board_id
    AND (stale_invite.disabled_at IS NOT NULL OR stale_invite.expires_at <= clock_timestamp());

  IF p_action LIKE 'owner_%' THEN
    IF p_owner_id IS NULL OR p_owner_id IS DISTINCT FROM board.owner_id THEN
      RAISE EXCEPTION 'guest_access_denied';
    END IF;
    IF p_action <> 'owner_list' THEN
      IF jsonb_typeof(p_payload->'revision') IS DISTINCT FROM 'number'
        OR (p_payload->>'revision') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
      expected_revision := (p_payload->>'revision')::bigint;
      IF expected_revision IS DISTINCT FROM board.revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
      IF board.published_at IS NOT NULL AND p_action NOT IN ('owner_list') THEN RAISE EXCEPTION 'guest_board_locked'; END IF;
    END IF;
  END IF;

  IF p_action IN ('guest_read','guest_hold','guest_confirm','guest_receipt','guest_release','guest_swap') THEN
    credential_kind := coalesce(p_payload->>'credentialKind','session');
    IF p_invite_id IS NULL AND p_action IN ('guest_receipt','guest_release','guest_swap')
      AND p_guest_hash ~ '^[a-f0-9]{64}$'
    THEN
      SELECT groups.* INTO claim_group
      FROM public.guest_claim_groups groups
      JOIN public.guest_invites current_invite ON current_invite.id=groups.invite_id
      WHERE current_invite.contest_id=p_board_id AND (
        (credential_kind='code' AND groups.claim_code_hash=p_guest_hash)
        OR (credential_kind='session' AND (groups.session_hash=p_guest_hash OR groups.management_hash=p_guest_hash))
      )
      FOR UPDATE OF groups;
      IF FOUND THEN
        SELECT current_invite.* INTO invite FROM public.guest_invites current_invite
        WHERE current_invite.id=claim_group.invite_id FOR UPDATE;
      END IF;
    ELSE
      SELECT current_invite.* INTO invite FROM public.guest_invites current_invite
      WHERE current_invite.id=p_invite_id AND current_invite.contest_id=p_board_id FOR UPDATE;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    invite_active := invite.disabled_at IS NULL
      AND (invite.expires_at IS NULL OR invite.expires_at > clock_timestamp());
  END IF;

  IF p_action IN ('guest_read','guest_hold','guest_confirm')
    OR (p_action IN ('guest_release','guest_swap') AND p_payload ? 'credentialVersion') THEN
    IF NOT invite_active THEN RAISE EXCEPTION 'guest_invite_inactive'; END IF;
    IF jsonb_typeof(p_payload->'credentialVersion') IS DISTINCT FROM 'number'
      OR (p_payload->>'credentialVersion')::bigint IS DISTINCT FROM invite.credential_version
    THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    IF board.shared_at IS NULL OR board.board_data->'isDynamic'='true'::jsonb THEN
      RAISE EXCEPTION 'guest_access_denied';
    END IF;
  END IF;

  IF p_action IN ('guest_hold','guest_confirm','guest_release','guest_swap')
    AND board.published_at IS NOT NULL THEN RAISE EXCEPTION 'guest_board_locked'; END IF;

  IF p_action = 'owner_create' THEN
    IF board.shared_at IS NULL OR board.published_at IS NOT NULL
      OR board.board_data->'isDynamic'='true'::jsonb
      OR p_payload->'offerAcknowledged' IS DISTINCT FROM 'true'::jsonb
    THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
    IF jsonb_typeof(p_payload->'cells') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_payload->'cells') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
    SELECT array_agg(value::integer ORDER BY value::integer) INTO requested_cells
      FROM jsonb_array_elements_text(p_payload->'cells') WITH ORDINALITY item(value,ordinal);
    IF EXISTS (SELECT 1 FROM unnest(requested_cells) idx WHERE idx NOT BETWEEN 0 AND 99)
      OR cardinality(requested_cells) <> (SELECT count(DISTINCT idx) FROM unnest(requested_cells) idx)
      OR EXISTS (SELECT 1 FROM unnest(requested_cells) idx
        WHERE coalesce(board.board_data->'availability'->>idx,'unspecified') <> 'available')
      OR jsonb_typeof(p_payload->'label') IS DISTINCT FROM 'string'
      OR char_length(btrim(p_payload->>'label')) NOT BETWEEN 1 AND 80
      OR jsonb_typeof(p_payload->'maxSquares') IS DISTINCT FROM 'number'
      OR (p_payload->>'maxSquares')::integer NOT BETWEEN 1 AND cardinality(requested_cells)
    THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
    payment_value := p_payload->'payment';
    IF payment_value = 'null'::jsonb THEN payment_value := NULL; END IF;
    IF payment_value IS NOT NULL AND (
      jsonb_typeof(payment_value) <> 'object'
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(payment_value) key WHERE key NOT IN ('label','detail','url'))
      OR jsonb_typeof(payment_value->'label') <> 'string'
      OR char_length(btrim(payment_value->>'label')) NOT BETWEEN 1 AND 80
      OR jsonb_typeof(payment_value->'detail') <> 'string'
      OR char_length(btrim(payment_value->>'detail')) NOT BETWEEN 1 AND 500
      OR (payment_value ? 'url' AND (jsonb_typeof(payment_value->'url') <> 'string'
        OR char_length(payment_value->>'url') > 2048 OR payment_value->>'url' !~ '^https://'))
    ) THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
    IF p_payload ? 'expiresAt' AND p_payload->'expiresAt' <> 'null'::jsonb
      AND ((p_payload->>'expiresAt')::timestamptz <= clock_timestamp())
    THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
    INSERT INTO public.guest_invites(contest_id,seller_label,cells,max_squares,expires_at,payment)
    VALUES(p_board_id,btrim(p_payload->>'label'),requested_cells,(p_payload->>'maxSquares')::integer,
      CASE WHEN p_payload->'expiresAt' IS NULL OR p_payload->'expiresAt'='null'::jsonb
        THEN NULL ELSE (p_payload->>'expiresAt')::timestamptz END,payment_value)
    RETURNING * INTO invite;
    event_name := 'guest.invite_created';

  ELSIF p_action IN ('owner_update','owner_disable','owner_rotate') THEN
    SELECT current_invite.* INTO invite FROM public.guest_invites current_invite
    WHERE current_invite.id=p_invite_id AND current_invite.contest_id=p_board_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    IF p_action='owner_disable' THEN
      UPDATE public.guest_invites SET disabled_at=coalesce(disabled_at,clock_timestamp()),updated_at=clock_timestamp()
      WHERE id=invite.id RETURNING * INTO invite;
      event_name := 'guest.invite_disabled';
    ELSIF p_action='owner_rotate' THEN
      UPDATE public.guest_invites SET credential_version=credential_version+1,disabled_at=NULL,updated_at=clock_timestamp()
      WHERE id=invite.id RETURNING * INTO invite;
      event_name := 'guest.invite_rotated';
    ELSE
      IF p_payload->'offerAcknowledged' IS DISTINCT FROM 'true'::jsonb
        OR jsonb_typeof(p_payload->'cells') IS DISTINCT FROM 'array'
        OR jsonb_typeof(p_payload->'label') IS DISTINCT FROM 'string'
        OR char_length(btrim(p_payload->>'label')) NOT BETWEEN 1 AND 80
        OR jsonb_typeof(p_payload->'maxSquares') IS DISTINCT FROM 'number'
      THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
      SELECT array_agg(value::integer ORDER BY value::integer) INTO requested_cells
        FROM jsonb_array_elements_text(p_payload->'cells') WITH ORDINALITY item(value,ordinal);
      IF cardinality(requested_cells) NOT BETWEEN 1 AND 100
        OR EXISTS (SELECT 1 FROM unnest(requested_cells) idx WHERE idx NOT BETWEEN 0 AND 99)
        OR cardinality(requested_cells) <> (SELECT count(DISTINCT idx) FROM unnest(requested_cells) idx)
        OR EXISTS (SELECT 1 FROM public.guest_square_claims claim WHERE claim.invite_id=invite.id
          AND claim.released_at IS NULL AND NOT claim.cell_index=ANY(requested_cells))
        OR EXISTS (SELECT 1 FROM unnest(requested_cells) idx
          WHERE coalesce(board.board_data->'availability'->>idx,'unspecified')<>'available'
            AND NOT EXISTS(SELECT 1 FROM public.guest_square_claims claim
              WHERE claim.invite_id=invite.id AND claim.cell_index=idx AND claim.released_at IS NULL))
        OR (p_payload->>'maxSquares')::integer NOT BETWEEN 1 AND cardinality(requested_cells)
        OR EXISTS (SELECT 1 FROM public.guest_claim_groups groups
          WHERE groups.invite_id=invite.id AND (SELECT count(*) FROM public.guest_square_claims claim
            WHERE claim.claim_group_id=groups.id AND claim.released_at IS NULL)>(p_payload->>'maxSquares')::integer)
      THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
      payment_value := p_payload->'payment';
      IF payment_value='null'::jsonb THEN payment_value:=NULL; END IF;
      IF payment_value IS NOT NULL AND (
        jsonb_typeof(payment_value)<>'object'
        OR EXISTS(SELECT 1 FROM jsonb_object_keys(payment_value) key WHERE key NOT IN ('label','detail','url'))
        OR jsonb_typeof(payment_value->'label')<>'string' OR char_length(btrim(payment_value->>'label')) NOT BETWEEN 1 AND 80
        OR jsonb_typeof(payment_value->'detail')<>'string' OR char_length(btrim(payment_value->>'detail')) NOT BETWEEN 1 AND 500
        OR (payment_value ? 'url' AND (jsonb_typeof(payment_value->'url')<>'string'
          OR char_length(payment_value->>'url')>2048 OR payment_value->>'url' !~ '^https://'))
      ) THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
      UPDATE public.guest_invites SET seller_label=btrim(coalesce(p_payload->>'label',seller_label)),cells=requested_cells,
        max_squares=(p_payload->>'maxSquares')::integer,
        expires_at=CASE WHEN p_payload->'expiresAt' IS NULL OR p_payload->'expiresAt'='null'::jsonb
          THEN NULL ELSE (p_payload->>'expiresAt')::timestamptz END,
        payment=payment_value,updated_at=clock_timestamp()
      WHERE id=invite.id RETURNING * INTO invite;
      DELETE FROM public.guest_square_holds WHERE invite_id=invite.id AND NOT cell_index=ANY(requested_cells);
      event_name := 'guest.invite_updated';
    END IF;
    DELETE FROM public.guest_square_holds WHERE invite_id=invite.id;

  ELSIF p_action='owner_cancel_holds' THEN
    IF p_invite_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.guest_invites current_invite
      WHERE current_invite.id=p_invite_id AND current_invite.contest_id=p_board_id
    ) THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    DELETE FROM public.guest_square_holds
    WHERE contest_id=p_board_id AND (p_invite_id IS NULL OR invite_id=p_invite_id);
    event_name := 'guest.holds_cancelled';

  ELSIF p_action IN ('owner_release_claim','owner_rotate_code') THEN
    IF (p_payload->>'groupId') IS NULL THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
    SELECT groups.* INTO claim_group FROM public.guest_claim_groups groups
    JOIN public.guest_invites current_invite ON current_invite.id=groups.invite_id
    WHERE groups.id=(p_payload->>'groupId')::uuid AND current_invite.contest_id=p_board_id FOR UPDATE OF groups;
    IF NOT FOUND THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    IF p_action='owner_rotate_code' THEN
      IF p_payload->>'claimCodeHash' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
      UPDATE public.guest_claim_groups SET claim_code_hash=p_payload->>'claimCodeHash',
        session_hash=md5(gen_random_uuid()::text)||md5(clock_timestamp()::text||gen_random_uuid()::text),
        management_hash=NULL,updated_at=clock_timestamp()
      WHERE id=claim_group.id RETURNING * INTO claim_group;
      event_name := 'guest.code_rotated';
    ELSE
      SELECT coalesce(array_agg(claim.cell_index ORDER BY claim.cell_index),'{}') INTO requested_cells
      FROM public.guest_square_claims claim WHERE claim.claim_group_id=claim_group.id AND claim.released_at IS NULL;
      UPDATE public.guest_claim_groups SET revoked_at=coalesce(revoked_at,clock_timestamp()),updated_at=clock_timestamp()
      WHERE id=claim_group.id RETURNING * INTO claim_group;
      UPDATE public.guest_square_claims SET released_at=clock_timestamp(),released_by=p_owner_id
      WHERE claim_group_id=claim_group.id AND released_at IS NULL;
      next_board := board.board_data;
      FOREACH cell IN ARRAY requested_cells LOOP
        next_board := jsonb_set(next_board,ARRAY['squares',cell::text],'[]'::jsonb,false);
        next_board := jsonb_set(next_board,ARRAY['availability',cell::text],'"available"'::jsonb,false);
      END LOOP;
      event_name := 'guest.claim_released';
    END IF;

  ELSIF p_action='guest_hold' THEN
    IF p_guest_hash IS NULL OR p_guest_hash !~ '^[a-f0-9]{64}$'
      OR jsonb_typeof(p_payload->'cells') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
    SELECT coalesce(array_agg(value::integer ORDER BY value::integer),'{}') INTO requested_cells
      FROM jsonb_array_elements_text(p_payload->'cells') WITH ORDINALITY item(value,ordinal);
    IF cardinality(requested_cells)=0 THEN
      SELECT groups.* INTO claim_group FROM public.guest_claim_groups groups
      WHERE groups.invite_id=invite.id AND groups.session_hash=p_guest_hash FOR UPDATE;
      IF FOUND THEN
        DELETE FROM public.guest_square_holds WHERE claim_group_id=claim_group.id;
        GET DIAGNOSTICS affected_count = ROW_COUNT;
        IF affected_count > 0 THEN event_name := 'guest.hold_released'; END IF;
      END IF;
    ELSE
    IF cardinality(requested_cells) > invite.max_squares THEN RAISE EXCEPTION 'guest_limit_exceeded'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(requested_cells) idx WHERE NOT idx=ANY(invite.cells))
      OR cardinality(requested_cells) <> (SELECT count(DISTINCT idx) FROM unnest(requested_cells) idx)
      OR EXISTS (SELECT 1 FROM unnest(requested_cells) idx
        WHERE coalesce(board.board_data->'availability'->>idx,'unspecified') <> 'available')
    THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    INSERT INTO public.guest_claim_groups(invite_id,session_hash)
    VALUES(invite.id,p_guest_hash) ON CONFLICT(invite_id,session_hash) DO UPDATE SET updated_at=clock_timestamp()
    RETURNING * INTO claim_group;
    IF claim_group.confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    SELECT count(*) INTO active_claim_count FROM public.guest_square_claims claim
      WHERE claim.claim_group_id=claim_group.id AND claim.released_at IS NULL;
    IF active_claim_count + cardinality(requested_cells) > invite.max_squares THEN RAISE EXCEPTION 'guest_limit_exceeded'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(requested_cells) idx
      WHERE EXISTS (SELECT 1 FROM public.guest_square_claims claim WHERE claim.contest_id=p_board_id
        AND claim.cell_index=idx AND claim.released_at IS NULL AND claim.claim_group_id<>claim_group.id)
      OR EXISTS (SELECT 1 FROM public.guest_square_holds hold WHERE hold.contest_id=p_board_id
        AND hold.cell_index=idx AND hold.expires_at>clock_timestamp() AND hold.claim_group_id<>claim_group.id))
    THEN RAISE EXCEPTION 'guest_hold_conflict'; END IF;
    SELECT min(hold.expires_at) INTO hold_deadline FROM public.guest_square_holds hold
      WHERE hold.claim_group_id=claim_group.id AND hold.expires_at>clock_timestamp();
    hold_deadline := coalesce(hold_deadline,clock_timestamp()+interval '90 seconds');
    DELETE FROM public.guest_square_holds WHERE claim_group_id=claim_group.id;
    INSERT INTO public.guest_square_holds(contest_id,cell_index,invite_id,claim_group_id,expires_at)
      SELECT p_board_id,idx,invite.id,claim_group.id,hold_deadline
      FROM unnest(requested_cells) idx;
    event_name := 'guest.hold_changed';
    END IF;

  ELSIF p_action='guest_confirm' THEN
    IF p_guest_hash IS NULL OR p_guest_hash !~ '^[a-f0-9]{64}$'
      OR jsonb_typeof(p_payload->'cells') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
    SELECT groups.* INTO claim_group FROM public.guest_claim_groups groups
      WHERE groups.invite_id=invite.id AND groups.session_hash=p_guest_hash FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    SELECT array_agg(value::integer ORDER BY value::integer) INTO requested_cells
      FROM jsonb_array_elements_text(p_payload->'cells') WITH ORDINALITY item(value,ordinal);
    name_value := btrim(p_payload->>'name');
    IF cardinality(requested_cells) NOT BETWEEN 1 AND invite.max_squares
      OR name_value IS NULL OR char_length(name_value) NOT BETWEEN 2 AND 30
      OR p_payload->>'claimCodeHash' !~ '^[a-f0-9]{64}$'
      OR (p_payload ? 'managementHash' AND p_payload->>'managementHash' !~ '^[a-f0-9]{64}$')
    THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
    IF claim_group.confirmed_at IS NOT NULL THEN
      SELECT array_agg(claim.cell_index ORDER BY claim.cell_index) INTO current_cells
      FROM public.guest_square_claims claim WHERE claim.claim_group_id=claim_group.id AND claim.released_at IS NULL;
      IF current_cells IS DISTINCT FROM requested_cells OR claim_group.display_name IS DISTINCT FROM name_value
        OR claim_group.claim_code_hash IS DISTINCT FROM p_payload->>'claimCodeHash'
      THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    ELSE
      IF (SELECT array_agg(hold.cell_index ORDER BY hold.cell_index) FROM public.guest_square_holds hold
        WHERE hold.claim_group_id=claim_group.id AND hold.expires_at>clock_timestamp()) IS DISTINCT FROM requested_cells
      THEN RAISE EXCEPTION 'guest_hold_expired'; END IF;
      UPDATE public.guest_claim_groups SET display_name=name_value,claim_code_hash=p_payload->>'claimCodeHash',
        management_hash=coalesce(p_payload->>'managementHash',management_hash),confirmed_at=clock_timestamp(),updated_at=clock_timestamp()
      WHERE id=claim_group.id RETURNING * INTO claim_group;
      INSERT INTO public.guest_square_claims(contest_id,cell_index,invite_id,claim_group_id)
        SELECT p_board_id,idx,invite.id,claim_group.id FROM unnest(requested_cells) idx;
      DELETE FROM public.guest_square_holds WHERE claim_group_id=claim_group.id;
      next_board := board.board_data;
      FOREACH cell IN ARRAY requested_cells LOOP
        next_board := jsonb_set(next_board,ARRAY['squares',cell::text],jsonb_build_array(name_value),false);
        next_board := jsonb_set(next_board,ARRAY['availability',cell::text],'"unavailable"'::jsonb,false);
      END LOOP;
      event_name := 'guest.claim_confirmed';
    END IF;

  ELSIF p_action IN ('guest_receipt','guest_release','guest_swap') THEN
    IF p_guest_hash IS NULL OR p_guest_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    credential_kind := coalesce(p_payload->>'credentialKind','session');
    SELECT groups.* INTO claim_group FROM public.guest_claim_groups groups
    WHERE groups.invite_id=invite.id AND groups.confirmed_at IS NOT NULL AND (
      (credential_kind='code' AND groups.claim_code_hash=p_guest_hash)
      OR (credential_kind='session' AND (groups.session_hash=p_guest_hash OR groups.management_hash=p_guest_hash))
    ) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    IF p_action<>'guest_receipt' AND NOT invite_active THEN RAISE EXCEPTION 'guest_invite_inactive'; END IF;
    IF p_action<>'guest_receipt' AND claim_group.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
    IF p_action='guest_release' THEN
      IF p_payload ? 'cells' THEN
        SELECT array_agg(value::integer ORDER BY value::integer) INTO requested_cells
          FROM jsonb_array_elements_text(p_payload->'cells') WITH ORDINALITY item(value,ordinal);
      ELSE
        SELECT coalesce(array_agg(claim.cell_index ORDER BY claim.cell_index),'{}') INTO requested_cells
        FROM public.guest_square_claims claim
        WHERE claim.claim_group_id=claim_group.id AND claim.released_at IS NULL;
      END IF;
      IF requested_cells IS NULL OR EXISTS (SELECT 1 FROM unnest(requested_cells) idx WHERE NOT EXISTS (
        SELECT 1 FROM public.guest_square_claims claim WHERE claim.claim_group_id=claim_group.id
          AND claim.cell_index=idx)) THEN RAISE EXCEPTION 'guest_access_denied'; END IF;
      SELECT coalesce(array_agg(claim.cell_index ORDER BY claim.cell_index),'{}') INTO active_release_cells
      FROM public.guest_square_claims claim WHERE claim.claim_group_id=claim_group.id
        AND claim.cell_index=ANY(requested_cells) AND claim.released_at IS NULL;
      UPDATE public.guest_square_claims SET released_at=clock_timestamp()
      WHERE claim_group_id=claim_group.id AND cell_index=ANY(active_release_cells) AND released_at IS NULL;
      IF cardinality(active_release_cells)>0 THEN
        next_board := board.board_data;
        FOREACH cell IN ARRAY active_release_cells LOOP
          next_board := jsonb_set(next_board,ARRAY['squares',cell::text],'[]'::jsonb,false);
          next_board := jsonb_set(next_board,ARRAY['availability',cell::text],'"available"'::jsonb,false);
        END LOOP;
        event_name := 'guest.claim_released';
      END IF;
    ELSIF p_action='guest_swap' THEN
      SELECT array_agg(value::integer ORDER BY value::integer) INTO desired_cells
        FROM jsonb_array_elements_text(p_payload->'cells') WITH ORDINALITY item(value,ordinal);
      SELECT coalesce(array_agg(claim.cell_index ORDER BY claim.cell_index),'{}') INTO current_cells
        FROM public.guest_square_claims claim WHERE claim.claim_group_id=claim_group.id AND claim.released_at IS NULL;
      IF cardinality(desired_cells) NOT BETWEEN 1 AND invite.max_squares
        OR EXISTS (SELECT 1 FROM unnest(desired_cells) idx WHERE NOT idx=ANY(invite.cells))
        OR cardinality(desired_cells)<>(SELECT count(DISTINCT idx) FROM unnest(desired_cells) idx)
      THEN RAISE EXCEPTION 'guest_invalid_request'; END IF;
      IF EXISTS (SELECT 1 FROM unnest(desired_cells) idx WHERE NOT idx=ANY(current_cells) AND (
          coalesce(board.board_data->'availability'->>idx,'unspecified')<>'available'
          OR EXISTS (SELECT 1 FROM public.guest_square_claims claim WHERE claim.contest_id=p_board_id
            AND claim.cell_index=idx AND claim.released_at IS NULL)
          OR EXISTS (SELECT 1 FROM public.guest_square_holds hold WHERE hold.contest_id=p_board_id
            AND hold.cell_index=idx AND hold.expires_at>clock_timestamp())))
      THEN RAISE EXCEPTION 'guest_square_conflict'; END IF;
      UPDATE public.guest_square_claims SET released_at=clock_timestamp()
      WHERE claim_group_id=claim_group.id AND released_at IS NULL AND NOT cell_index=ANY(desired_cells);
      INSERT INTO public.guest_square_claims(contest_id,cell_index,invite_id,claim_group_id)
        SELECT p_board_id,idx,invite.id,claim_group.id FROM unnest(desired_cells) idx
        WHERE NOT idx=ANY(current_cells);
      DELETE FROM public.guest_square_holds WHERE contest_id=p_board_id AND cell_index=ANY(desired_cells);
      next_board := board.board_data;
      FOREACH cell IN ARRAY current_cells LOOP
        IF NOT cell=ANY(desired_cells) THEN
          next_board := jsonb_set(next_board,ARRAY['squares',cell::text],'[]'::jsonb,false);
          next_board := jsonb_set(next_board,ARRAY['availability',cell::text],'"available"'::jsonb,false);
        END IF;
      END LOOP;
      FOREACH cell IN ARRAY desired_cells LOOP
        next_board := jsonb_set(next_board,ARRAY['squares',cell::text],jsonb_build_array(claim_group.display_name),false);
        next_board := jsonb_set(next_board,ARRAY['availability',cell::text],'"unavailable"'::jsonb,false);
      END LOOP;
      event_name := 'guest.claim_swapped';
    END IF;
  END IF;

  IF p_action='public_state' AND board.shared_at IS NULL AND board.published_at IS NULL THEN
    RAISE EXCEPTION 'guest_access_denied';
  END IF;

  IF p_action='guest_read' AND p_guest_hash ~ '^[a-f0-9]{64}$' THEN
    SELECT groups.* INTO claim_group FROM public.guest_claim_groups groups
    WHERE groups.invite_id=invite.id AND (
      (credential_kind='code' AND groups.claim_code_hash=p_guest_hash)
      OR (credential_kind='session' AND (groups.session_hash=p_guest_hash OR groups.management_hash=p_guest_hash))
    );
  END IF;

  IF next_board IS NOT NULL THEN
    UPDATE public.contests SET board_data=next_board WHERE id=p_board_id RETURNING revision INTO next_revision;
  ELSIF event_name IS NOT NULL THEN
    UPDATE public.contests SET updated_at=clock_timestamp() WHERE id=p_board_id RETURNING revision INTO next_revision;
  ELSE
    next_revision := board.revision;
  END IF;

  IF event_name IS NOT NULL THEN
    INSERT INTO public.contest_audit_events(contest_id,actor_id,event_type,entity_type,entity_id,
      previous_revision,next_revision,details)
    VALUES(p_board_id,CASE WHEN p_action LIKE 'owner_%' THEN p_owner_id ELSE NULL END,event_name,
      CASE WHEN invite.id IS NULL THEN 'guest_board' ELSE 'guest_invite' END,invite.id,
      board.revision,next_revision,
      jsonb_build_object('inviteId',invite.id,'groupId',claim_group.id,'cells',coalesce(requested_cells,desired_cells,'{}')));
    PERFORM public.gridone_guest_emit(p_board_id,event_name,next_revision);
    SELECT contest.* INTO board FROM public.contests contest WHERE contest.id=p_board_id;
  END IF;

  IF p_action LIKE 'owner_%' THEN
    SELECT jsonb_build_object(
      'revision',board.revision,
      'invites',coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id',i.id,'label',i.seller_label,'cells',i.cells,'maxSquares',i.max_squares,
        'version',i.credential_version,'expiresAt',i.expires_at,'disabledAt',i.disabled_at,
        'payment',i.payment,'url','',
        'counts',jsonb_build_object(
          'available',(SELECT count(*) FROM unnest(i.cells) idx
            WHERE coalesce(board.board_data->'availability'->>idx,'unspecified')='available'
              AND NOT EXISTS(SELECT 1 FROM public.guest_square_claims c WHERE c.contest_id=p_board_id AND c.cell_index=idx AND c.released_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM public.guest_square_holds h WHERE h.contest_id=p_board_id AND h.cell_index=idx AND h.expires_at>clock_timestamp())),
          'held',(SELECT count(*) FROM public.guest_square_holds h WHERE h.invite_id=i.id AND h.expires_at>clock_timestamp()),
          'claimed',(SELECT count(*) FROM public.guest_square_claims c WHERE c.invite_id=i.id AND c.released_at IS NULL)
        )) ORDER BY i.created_at)
        FROM public.guest_invites i WHERE i.contest_id=p_board_id),'[]'::jsonb),
      'claims',coalesce((SELECT jsonb_agg(receipt ORDER BY receipt->>'claimedAt') FROM (
        SELECT jsonb_build_object('groupId',g.id,'inviteId',g.invite_id,'displayName',g.display_name,
          'cells',coalesce(array_agg(c.cell_index ORDER BY c.cell_index) FILTER(WHERE c.released_at IS NULL),'{}'),
          'claimedAt',g.confirmed_at,'canManage',g.confirmed_at IS NOT NULL AND board.published_at IS NULL
            AND g.revoked_at IS NULL AND i.disabled_at IS NULL AND (i.expires_at IS NULL OR i.expires_at>clock_timestamp()),
          'payment',NULL,'source','guest') receipt
        FROM public.guest_claim_groups g JOIN public.guest_invites i ON i.id=g.invite_id
        LEFT JOIN public.guest_square_claims c ON c.claim_group_id=g.id
        WHERE i.contest_id=p_board_id AND g.confirmed_at IS NOT NULL GROUP BY g.id,i.id) rows),'[]'::jsonb),
      'holds',coalesce((SELECT jsonb_agg(jsonb_build_object('index',h.cell_index,'expiresAt',h.expires_at,'inviteId',h.invite_id)
        ORDER BY h.cell_index) FROM public.guest_square_holds h
        WHERE h.contest_id=p_board_id AND h.expires_at>clock_timestamp()),'[]'::jsonb)
    ) INTO result;
    RETURN result;
  END IF;

  IF p_action IN ('guest_confirm','guest_receipt','guest_release','guest_swap') THEN
    SELECT jsonb_build_object('groupId',claim_group.id,'inviteId',invite.id,'displayName',claim_group.display_name,
      'cells',coalesce(array_agg(claim.cell_index ORDER BY claim.cell_index) FILTER(WHERE claim.released_at IS NULL),'{}'),
      'claimedAt',claim_group.confirmed_at,
      'canManage',claim_group.revoked_at IS NULL AND invite_active AND board.published_at IS NULL,
      'payment',invite.payment)
    INTO result FROM public.guest_square_claims claim WHERE claim.claim_group_id=claim_group.id;
    RETURN result;
  END IF;

  -- guest_read, guest_hold, and public_state return a narrow public projection.
  SELECT jsonb_build_object('boardId',board.id,'title',board.title,'shareCode',board.share_code,
    'revision',board.revision,'serverTime',clock_timestamp(),
    'stage',CASE WHEN board.published_at IS NULL THEN 'selling' ELSE 'finalized' END,
    'squares',board.board_data->'squares',
    'allocationLabels',coalesce(board.board_data->'allocationLabels','[]'::jsonb),
    'availability',coalesce(board.board_data->'availability','[]'::jsonb),
    'holds',coalesce((SELECT jsonb_agg(jsonb_build_object('index',h.cell_index,'expiresAt',h.expires_at,
      'mine',CASE WHEN claim_group.id IS NULL THEN NULL ELSE h.claim_group_id=claim_group.id END) ORDER BY h.cell_index)
      FROM public.guest_square_holds h WHERE h.contest_id=p_board_id AND h.expires_at>clock_timestamp()),'[]'::jsonb),
    'claimedCells',coalesce((SELECT jsonb_agg(c.cell_index ORDER BY c.cell_index)
      FROM public.guest_square_claims c WHERE c.contest_id=p_board_id AND c.released_at IS NULL),'[]'::jsonb),
    'heldCells',coalesce((SELECT jsonb_agg(h.cell_index ORDER BY h.cell_index)
      FROM public.guest_square_holds h WHERE h.claim_group_id=claim_group.id AND h.expires_at>clock_timestamp()),'[]'::jsonb)
  ) INTO result;
  IF p_action<>'public_state' THEN
    result := result || jsonb_build_object('invite',jsonb_build_object(
      'id',invite.id,'label',invite.seller_label,'cells',invite.cells,'maxSquares',invite.max_squares,
      'version',invite.credential_version,'expiresAt',invite.expires_at,'disabledAt',invite.disabled_at));
    IF claim_group.confirmed_at IS NOT NULL THEN
      result := result || jsonb_build_object('mine',jsonb_build_object(
        'groupId',claim_group.id,'inviteId',invite.id,'displayName',claim_group.display_name,
        'cells',coalesce((SELECT jsonb_agg(claim.cell_index ORDER BY claim.cell_index)
          FROM public.guest_square_claims claim WHERE claim.claim_group_id=claim_group.id AND claim.released_at IS NULL),'[]'::jsonb),
        'claimedAt',claim_group.confirmed_at,'canManage',claim_group.revoked_at IS NULL AND invite_active AND board.published_at IS NULL,
        'payment',invite.payment));
    END IF;
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_guest_action(text,uuid,uuid,uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_guest_action(text,uuid,uuid,uuid,text,jsonb) TO service_role;
