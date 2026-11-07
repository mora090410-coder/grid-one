-- Repair family display-name clearing and seller inventory agreement.
-- No table, grant, capability scope, lock, payment or scoring changes.
-- Apply only after deployment approval; locally exercised against disposable PG.
BEGIN;
DO $migration$
DECLARE
  definition text;
  old_text text;
  new_text text;
  replacements text[][] := ARRAY[
    ARRAY[$old$char_length(btrim(change->>'name')) NOT BETWEEN 1 AND 80$old$,
          $new$char_length(btrim(change->>'name')) NOT BETWEEN 0 AND 80$new$],
    ARRAY[$old$jsonb_build_array(btrim(change->>'name'))$old$,
          $new$CASE WHEN btrim(change->>'name') = '' THEN '[]'::jsonb ELSE jsonb_build_array(btrim(change->>'name')) END$new$]
  ];
  replacement text[];
BEGIN
  definition := pg_get_functiondef('public.gridone_family_access(text,uuid,uuid,bigint,text,text,integer[],jsonb)'::regprocedure);
  FOREACH replacement SLICE 1 IN ARRAY replacements LOOP
    old_text := replacement[1]; new_text := replacement[2];
    IF (length(definition) - length(replace(definition,old_text,''))) / length(old_text) <> 1 THEN
      RAISE EXCEPTION 'Family workflow prerequisite mismatch';
    END IF;
    definition := replace(definition,old_text,new_text);
  END LOOP;
  EXECUTE definition;
END;
$migration$;

DO $migration$
DECLARE
  definition text;
  old_text text;
  new_text text;
  replacements text[][] := ARRAY[
    ARRAY[$old$next_board->'squares'->cell->>0 IS DISTINCT FROM link.label$old$,
          $new$NOT (next_board->'squares'->cell = jsonb_build_array(link.label)
          OR (next_board->'squares'->cell = '[]'::jsonb AND next_board->'availability'->>cell IS NOT DISTINCT FROM 'available'))$new$],
    ARRAY[$old$board.board_data->'squares'->((idx - 1)::integer)->>0 IS NOT DISTINCT FROM link.label$old$,
          $new$(board.board_data->'squares'->((idx - 1)::integer) = jsonb_build_array(link.label)
          OR (board.board_data->'squares'->((idx - 1)::integer) = '[]'::jsonb
            AND board.board_data->'availability'->>((idx - 1)::integer) IS NOT DISTINCT FROM 'available'))$new$],
    ARRAY[$old$    next_board := board.board_data;$old$,
          $new$    next_board := board.board_data;
    IF NOT (next_board ? 'availability') THEN
      next_board := jsonb_set(next_board,'{availability}',(SELECT jsonb_agg('unspecified'::text) FROM generate_series(1,100)));
    END IF;$new$],
    ARRAY[$old$      next_board := jsonb_set(next_board, ARRAY['squares', cell::text], jsonb_build_array(name_value));$old$,
          $new$      next_board := jsonb_set(next_board, ARRAY['squares', cell::text], jsonb_build_array(name_value));
      next_board := jsonb_set(next_board, ARRAY['availability', cell::text], '"unavailable"'::jsonb);$new$]
  ];
  replacement text[];
BEGIN
  definition := pg_get_functiondef('public.gridone_seller_link(text,uuid,uuid,text,text,integer[],text)'::regprocedure);
  FOREACH replacement SLICE 1 IN ARRAY replacements LOOP
    old_text := replacement[1]; new_text := replacement[2];
    IF (length(definition) - length(replace(definition,old_text,''))) / length(old_text) <> 1 THEN
      RAISE EXCEPTION 'Seller workflow prerequisite mismatch';
    END IF;
    definition := replace(definition,old_text,new_text);
  END LOOP;
  EXECUTE definition;
END;
$migration$;
COMMIT;
