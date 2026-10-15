-- Keep the existing name-based occupancy contract, but never allow a buyer
-- to write its unsold sentinel. No axis, scope, locking or grant changes.
BEGIN;
DO $migration$
DECLARE
  definition text;
  old_text text := '    next_board := board.board_data;';
  new_text text := $replacement$    IF lower(regexp_replace(normalize(name_value, NFKC), '[[:space:]]+', '', 'g'))
      = lower(regexp_replace(normalize(link.label, NFKC), '[[:space:]]+', '', 'g')) THEN
      RAISE EXCEPTION 'seller_name_matches_label';
    END IF;
    next_board := board.board_data;$replacement$;
BEGIN
  definition := pg_get_functiondef('public.gridone_seller_link(text,uuid,uuid,text,text,integer[],text)'::regprocedure);
  IF (length(definition) - length(replace(definition, old_text, ''))) / length(old_text) <> 1 THEN
    RAISE EXCEPTION 'Seller guard prerequisite mismatch';
  END IF;
  EXECUTE replace(definition, old_text, new_text);
END;
$migration$;
COMMIT;
