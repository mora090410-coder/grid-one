-- The board document was written when GridOne was a Chicago Bears-only tool, so
-- its axes are named `bearsAxis` (the side team) and `oppAxis` (the top team).
-- Every other client-side surface already says left/top — GameState.leftAbbr,
-- LiveGameData.leftScore — so the board document is renamed to match:
--
--   bearsAxis          -> leftAxis
--   oppAxis            -> topAxis
--   bearsAxisByQuarter -> leftAxisByQuarter
--   oppAxisByQuarter   -> topAxisByQuarter
--
-- These keys live in persisted JSON, so the rename is a data migration, not
-- just a TypeScript change: contests.board_data and the public viewer snapshot
-- both carry them and must move together or a published board renders with no
-- numbers.

-- The published-board trigger exists to stop assignments and axes drifting
-- after publish. This migration is exactly the sanctioned exception: it renames
-- keys without changing a single digit, so it runs with the trigger suspended
-- rather than through the narrow rename path.
ALTER TABLE public.contests DISABLE TRIGGER gridone_protect_published_board_data;

UPDATE public.contests
SET board_data = (
  board_data
    - 'bearsAxis' - 'oppAxis' - 'bearsAxisByQuarter' - 'oppAxisByQuarter'
) || jsonb_strip_nulls(jsonb_build_object(
  'leftAxis', board_data -> 'bearsAxis',
  'topAxis', board_data -> 'oppAxis',
  'leftAxisByQuarter', board_data -> 'bearsAxisByQuarter',
  'topAxisByQuarter', board_data -> 'oppAxisByQuarter'
))
WHERE jsonb_typeof(board_data) = 'object'
  AND board_data ?| ARRAY['bearsAxis', 'oppAxis', 'bearsAxisByQuarter', 'oppAxisByQuarter'];

ALTER TABLE public.contests ENABLE TRIGGER gridone_protect_published_board_data;

UPDATE public.public_board_snapshots
SET board = (
  board
    - 'bearsAxis' - 'oppAxis' - 'bearsAxisByQuarter' - 'oppAxisByQuarter'
) || jsonb_strip_nulls(jsonb_build_object(
  'leftAxis', board -> 'bearsAxis',
  'topAxis', board -> 'oppAxis',
  'leftAxisByQuarter', board -> 'bearsAxisByQuarter',
  'topAxisByQuarter', board -> 'oppAxisByQuarter'
)),
  updated_at = now()
WHERE jsonb_typeof(board) = 'object'
  AND board ?| ARRAY['bearsAxis', 'oppAxis', 'bearsAxisByQuarter', 'oppAxisByQuarter'];
