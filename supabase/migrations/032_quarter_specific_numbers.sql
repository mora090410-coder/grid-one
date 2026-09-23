-- New numbers each quarter: four top/side sets (Q1, Q2, Q3, Q4=Final incl. OT) on one permanent assignment grid.
BEGIN;

CREATE FUNCTION public.gridone_validate_number_sets(p_board jsonb, p_final boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE side text; period text; sets jsonb; axis jsonb; digit jsonb;
BEGIN
  IF p_board ? 'isDynamic' AND jsonb_typeof(p_board->'isDynamic') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'Invalid number mode';
  END IF;
  FOREACH side IN ARRAY ARRAY['leftAxis','topAxis'] LOOP
    -- Fixed published legacy JSON may be absent/unusable; locked SQL columns are canonical.
    IF p_final AND coalesce(p_board->'isDynamic','false'::jsonb) <> 'true'::jsonb THEN CONTINUE; END IF;
    axis := p_board->side;
    IF axis IS NULL THEN CONTINUE; END IF;
    IF jsonb_typeof(axis) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Axis needs ten positions'; END IF;
    IF jsonb_array_length(axis) <> 10 THEN RAISE EXCEPTION 'Axis needs ten positions'; END IF;
    FOR digit IN SELECT value FROM jsonb_array_elements(axis) LOOP
      IF digit = 'null'::jsonb THEN CONTINUE; END IF;
      IF jsonb_typeof(digit) IS DISTINCT FROM 'number' OR digit::text !~ '^[0-9]$' THEN RAISE EXCEPTION 'Axis needs digits 0-9'; END IF;
    END LOOP;
  END LOOP;
  FOREACH side IN ARRAY ARRAY['leftAxisByQuarter','topAxisByQuarter'] LOOP
    sets := p_board->side;
    IF sets IS NULL AND NOT (p_final AND coalesce(p_board->'isDynamic','false'::jsonb) = 'true'::jsonb) THEN CONTINUE; END IF;
    IF jsonb_typeof(sets) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Quarter axes need review'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(sets) k WHERE k NOT IN ('Q1','Q2','Q3','Q4')) THEN
      RAISE EXCEPTION 'Unsupported quarter axis key';
    END IF;
    FOREACH period IN ARRAY ARRAY['Q1','Q2','Q3','Q4'] LOOP
      axis := sets->period;
      IF axis IS NULL AND NOT (p_final AND coalesce(p_board->'isDynamic','false'::jsonb) = 'true'::jsonb) THEN CONTINUE; END IF;
      IF jsonb_typeof(axis) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Quarter axis needs ten positions'; END IF;
      IF jsonb_array_length(axis) <> 10 THEN RAISE EXCEPTION 'Quarter axis needs ten positions'; END IF;
      FOR digit IN SELECT value FROM jsonb_array_elements(axis) LOOP
        IF digit = 'null'::jsonb AND NOT (p_final AND coalesce(p_board->'isDynamic','false'::jsonb) = 'true'::jsonb) THEN CONTINUE; END IF;
        IF jsonb_typeof(digit) IS DISTINCT FROM 'number' OR digit::text !~ '^[0-9]$' THEN
          RAISE EXCEPTION 'Quarter axis needs digits 0-9';
        END IF;
      END LOOP;
      IF p_final AND coalesce(p_board->'isDynamic','false'::jsonb) = 'true'::jsonb
        AND (SELECT count(DISTINCT value) FROM jsonb_array_elements(axis)) <> 10 THEN
        RAISE EXCEPTION 'Every quarter axis needs ten unique digits';
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_validate_number_sets(jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gridone_validate_number_sets(jsonb,boolean) TO authenticated,service_role;

-- Read-only preflight. Never rewrite locked numbers, snapshots, awards or delivery queues.
-- An affected installation needs a separately approved inventory/preservation decision.
DO $preflight$
DECLARE c record; s record;
BEGIN
  FOR c IN SELECT id,board_data,side_axis,top_axis,side_team_abbr,top_team_abbr,published_at FROM public.contests LOOP
    BEGIN
      PERFORM public.gridone_validate_number_sets(c.board_data,c.published_at IS NOT NULL);
      IF c.published_at IS NOT NULL AND c.board_data ? 'scanReview' AND (
        coalesce(c.board_data#>>'{scanReview,orientation,operation}','') NOT IN ('unchanged','transposed')
        OR c.board_data#>>'{scanReview,orientation,topAbbr}' IS DISTINCT FROM c.top_team_abbr
        OR c.board_data#>>'{scanReview,orientation,leftAbbr}' IS DISTINCT FROM c.side_team_abbr
      ) THEN RAISE EXCEPTION 'photo team orientation requires explicit review'; END IF;
      IF c.published_at IS NOT NULL AND c.board_data->'isDynamic' = 'true'::jsonb THEN
        IF to_jsonb(c.side_axis) IS DISTINCT FROM c.board_data->'leftAxisByQuarter'->'Q1'
          OR to_jsonb(c.top_axis) IS DISTINCT FROM c.board_data->'topAxisByQuarter'->'Q1' THEN
          RAISE EXCEPTION 'locked compatibility columns differ from Q1';
        END IF;
        SELECT board INTO s FROM public.public_board_snapshots WHERE contest_id=c.id;
        IF NOT FOUND OR s.board->'isDynamic' IS DISTINCT FROM 'true'::jsonb
          OR s.board->'leftAxisByQuarter' IS DISTINCT FROM c.board_data->'leftAxisByQuarter'
          OR s.board->'topAxisByQuarter' IS DISTINCT FROM c.board_data->'topAxisByQuarter'
          OR s.board->'leftAxis' IS DISTINCT FROM to_jsonb(c.side_axis)
          OR s.board->'topAxis' IS DISTINCT FROM to_jsonb(c.top_axis) THEN
          RAISE EXCEPTION 'published snapshot lacks canonical quarter evidence';
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Quarter migration preflight: contest %: %. STOP: obtain read-only inventory and explicit legacy preservation approval; do not overwrite locked digits, awards or queued notifications.',c.id,SQLERRM;
    END;
  END LOOP;
END;
$preflight$;

CREATE FUNCTION public.gridone_axis_for_milestone(p_board jsonb, p_fixed smallint[], p_side text, p_milestone text)
RETURNS smallint[] LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE axis smallint[]; period text;
BEGIN
  IF coalesce(p_board->'isDynamic','false'::jsonb) <> 'true'::jsonb THEN RETURN p_fixed; END IF;
  PERFORM public.gridone_validate_number_sets(p_board,true);
  period := CASE upper(p_milestone) WHEN 'FINAL' THEN 'Q4' WHEN 'OT' THEN 'Q4' ELSE upper(p_milestone) END;
  IF period NOT IN ('Q1','Q2','Q3','Q4') OR p_side NOT IN ('left','top') THEN RAISE EXCEPTION 'Invalid quarter axis lookup'; END IF;
  SELECT array_agg((value::text)::smallint ORDER BY ordinality) INTO axis
    FROM jsonb_array_elements(p_board->(p_side || 'AxisByQuarter')->period) WITH ORDINALITY;
  RETURN axis;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_axis_for_milestone(jsonb,smallint[],text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.gridone_protect_number_sets()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.gridone_validate_number_sets(NEW.board_data,NEW.published_at IS NOT NULL);
  IF NEW.published_at IS NOT NULL AND NEW.board_data ? 'scanReview' AND (
    coalesce(NEW.board_data#>>'{scanReview,orientation,operation}','') NOT IN ('unchanged','transposed')
    OR NEW.board_data#>>'{scanReview,orientation,topAbbr}' IS DISTINCT FROM NEW.top_team_abbr
    OR NEW.board_data#>>'{scanReview,orientation,leftAbbr}' IS DISTINCT FROM NEW.side_team_abbr
  ) THEN RAISE EXCEPTION 'Resolve photo team orientation before publishing'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.axis_locked_at IS NOT NULL AND (
    NEW.board_data->'isDynamic' IS DISTINCT FROM OLD.board_data->'isDynamic'
    OR NEW.board_data->'leftAxisByQuarter' IS DISTINCT FROM OLD.board_data->'leftAxisByQuarter'
    OR NEW.board_data->'topAxisByQuarter' IS DISTINCT FROM OLD.board_data->'topAxisByQuarter'
  ) THEN RAISE EXCEPTION 'Published quarter number sets are locked'; END IF;
  IF NEW.published_at IS NOT NULL AND NEW.board_data->'isDynamic' = 'true'::jsonb THEN
    IF to_jsonb(NEW.side_axis) IS DISTINCT FROM NEW.board_data->'leftAxisByQuarter'->'Q1'
      OR to_jsonb(NEW.top_axis) IS DISTINCT FROM NEW.board_data->'topAxisByQuarter'->'Q1' THEN
      RAISE EXCEPTION 'Compatibility axes must match locked Q1';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_protect_number_sets() FROM PUBLIC;
CREATE TRIGGER gridone_protect_number_sets BEFORE INSERT OR UPDATE ON public.contests
FOR EACH ROW EXECUTE FUNCTION public.gridone_protect_number_sets();

CREATE FUNCTION public.gridone_project_number_sets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE source_board jsonb; public_axes jsonb; side_axis smallint[]; top_axis smallint[]; participants jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.contest_id IS DISTINCT FROM OLD.contest_id THEN
    RAISE EXCEPTION 'Published snapshot identity is locked';
  END IF;
  SELECT c.board_data,c.side_axis,c.top_axis INTO source_board,side_axis,top_axis FROM public.contests c WHERE id = NEW.contest_id;
  IF (NEW.board ? 'leftAxis' AND NEW.board->'leftAxis' IS DISTINCT FROM to_jsonb(side_axis))
    OR (NEW.board ? 'topAxis' AND NEW.board->'topAxis' IS DISTINCT FROM to_jsonb(top_axis)) THEN
    RAISE EXCEPTION 'Published flat axes must match the locked board';
  END IF;
  IF coalesce(NEW.board->'isDynamic','false'::jsonb) IS DISTINCT FROM coalesce(source_board->'isDynamic','false'::jsonb) THEN
    RAISE EXCEPTION 'Published number mode must match the locked board';
  END IF;
  IF source_board->'isDynamic' = 'true'::jsonb THEN
    PERFORM public.gridone_validate_number_sets(source_board,true);
    public_axes := jsonb_build_object('isDynamic',true,
      'leftAxisByQuarter',source_board->'leftAxisByQuarter',
      'topAxisByQuarter',source_board->'topAxisByQuarter');
    IF NEW.board->'isDynamic' IS DISTINCT FROM 'true'::jsonb
      OR NEW.board->'leftAxisByQuarter' IS DISTINCT FROM public_axes->'leftAxisByQuarter'
      OR NEW.board->'topAxisByQuarter' IS DISTINCT FROM public_axes->'topAxisByQuarter' THEN
      RAISE EXCEPTION 'Published quarter axes must match the locked board';
    END IF;
  ELSE
    NEW.board := NEW.board - 'leftAxisByQuarter' - 'topAxisByQuarter';
  END IF;
  -- Derive nested participant identities from canonical rows, never the caller payload.
  NEW.board := NEW.board || jsonb_build_object('leftAxis',side_axis,'topAxis',top_axis,'isDynamic',coalesce(source_board->'isDynamic','false'::jsonb));
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'displayName',p.display_name,'publicLabel',p.public_label)
    ORDER BY p.sort_order,p.display_name),'[]'::jsonb) INTO participants
    FROM public.contest_participants p WHERE p.contest_id=NEW.contest_id;
  NEW.board := jsonb_set(NEW.board,'{participants}',participants);
  -- Projection is an allowlist. Literal scan evidence and private metadata stay private.
  SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO NEW.board FROM jsonb_each(NEW.board)
    WHERE key IN ('squares','leftAxis','topAxis','isDynamic','leftAxisByQuarter','topAxisByQuarter',
      'allocationLabels','availability','participation','allowOpenSquares','participants');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_project_number_sets() FROM PUBLIC;
CREATE TRIGGER gridone_project_number_sets BEFORE INSERT OR UPDATE OF board,contest_id ON public.public_board_snapshots
FOR EACH ROW EXECUTE FUNCTION public.gridone_project_number_sets();

-- Apply narrow, asserted deltas to existing transaction implementations. Their complete
-- authority, row/advisory locks, confirmation windows, audit and delivery logic are retained.
-- Each old fragment must occur exactly once; unexpected upstream schema fails the migration.
DO $migration$
DECLARE spec record; definition text;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('public.gridone_validate_sales_board(jsonb)',
      E'  IF p_board->\'isDynamic\' = \'true\'::jsonb THEN\n    RAISE EXCEPTION \'Legacy dynamic boards require a preservation plan before sharing\';\n  END IF;',
      '  PERFORM public.gridone_validate_number_sets(p_board,false);'),
    ('public.gridone_protect_sales_sharing()',
      E'  IF TG_OP = \'UPDATE\' AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL\n    AND OLD.board_data->\'isDynamic\' = \'true\'::jsonb THEN\n    RAISE EXCEPTION \'Legacy dynamic boards require a preservation plan before finalizing\';\n  END IF;',
      '  -- Quarter validation and locking are enforced by gridone_protect_number_sets.'),
    ('public.gridone_family_access(text,uuid,uuid,bigint,text,text,integer[],jsonb)',
      E'\n    OR current_board.board_data->\'isDynamic\' = \'true\'::jsonb',
      ''),
    ('public.gridone_observe_milestones_unchecked(uuid,uuid)',
      'array_position(current_contest.side_axis, (candidate_side % 10)::smallint)',
      'array_position(public.gridone_axis_for_milestone(current_contest.board_data,current_contest.side_axis,''left'',milestone_name), (candidate_side % 10)::smallint)'),
    ('public.gridone_observe_milestones_unchecked(uuid,uuid)',
      'array_position(current_contest.top_axis, (candidate_top % 10)::smallint)',
      'array_position(public.gridone_axis_for_milestone(current_contest.board_data,current_contest.top_axis,''top'',milestone_name), (candidate_top % 10)::smallint)'),
    ('public.gridone_correct_milestone(uuid,uuid,text,integer,integer,integer,text)',
      'array_position(current_contest.side_axis, (p_side_score % 10)::smallint)',
      'array_position(public.gridone_axis_for_milestone(current_contest.board_data,current_contest.side_axis,''left'',p_milestone), (p_side_score % 10)::smallint)'),
    ('public.gridone_correct_milestone(uuid,uuid,text,integer,integer,integer,text)',
      'array_position(current_contest.top_axis, (p_top_score % 10)::smallint)',
      'array_position(public.gridone_axis_for_milestone(current_contest.board_data,current_contest.top_axis,''top'',p_milestone), (p_top_score % 10)::smallint)'),
    -- Seller links (031) work on boards with new numbers each quarter.
    ('public.gridone_seller_link(text,uuid,uuid,text,text,integer[],text)',
      E'\n    AND board.board_data->\'isDynamic\' IS DISTINCT FROM \'true\'::jsonb;',
      ';')
  ) AS deltas(signature,old_text,new_text) LOOP
    definition := pg_get_functiondef(spec.signature::regprocedure);
    IF (length(definition)-length(replace(definition,spec.old_text,''))) / length(spec.old_text) <> 1 THEN
      RAISE EXCEPTION 'Quarter migration prerequisite mismatch: %',spec.signature;
    END IF;
    EXECUTE replace(definition,spec.old_text,spec.new_text);
  END LOOP;
END;
$migration$;
COMMIT;
