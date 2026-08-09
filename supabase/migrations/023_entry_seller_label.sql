-- Sellers and owners are different people on a fundraiser board: a coach hands
-- a block of squares to a parent to sell, and the buyer's name lands on the
-- square later. Keeping only the final name loses the answer to "who collected
-- this money and who still owes me", which is the organizer's real ledger.
--
-- seller_label is therefore additive metadata on the entry, not a replacement
-- for the name in contests.board_data.squares (which stays the display owner).

ALTER TABLE public.contest_entries
  ADD COLUMN IF NOT EXISTS seller_label text NULL
    CHECK (seller_label IS NULL OR char_length(seller_label) BETWEEN 1 AND 80);

COMMENT ON COLUMN public.contest_entries.seller_label IS
  'Who sold this square. Survives the placeholder-to-owner rename; never shown as the square owner.';

-- Organizer dashboards group unpaid squares by seller to chase collections.
CREATE INDEX IF NOT EXISTS contest_entries_seller_label_idx
  ON public.contest_entries (contest_id, seller_label)
  WHERE seller_label IS NOT NULL;
