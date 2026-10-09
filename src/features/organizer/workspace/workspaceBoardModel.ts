import type { BoardData, EntryMeta, QuarterAxes, SquareAvailability } from '../../../../types';
import { getAxisForQuarter } from '../../../../utils/winnerLogic';
import { QUARTER_KEYS, type QuarterAxisKey } from '../../../../utils/quarterAxes';
import { secureShuffleDigits } from './secureDraw';

/**
 * Pure board-editing rules for the organizer workspace. The component calls
 * these and renders the result; it does not decide how a board changes.
 */

export const openCountOf = (board: BoardData) => board.squares.filter((names) => !names.length).length;

/**
 * A square's seller (allocation label) is sticky: once a square belongs to a
 * seller it keeps that label, even when a buyer's name replaces the seller's.
 * A square with no label yet takes its current name, then the offered label,
 * then the new name.
 */
const allocationFor = (board: BoardData, index: number, offered: string | null | undefined, name: string) =>
  board.allocationLabels?.[index] || board.squares[index]?.[0] || offered || name || null;

/** Shown when Save is used on a square that has no name. */
export const OPEN_SQUARE_NAME_REQUIRED = 'Enter a name before saving an open square.';

/**
 * A blank name on a square that is already open changes nothing on the board.
 * That save must be refused, and it must not write a payment row.
 */
export const isBlankOpenSquareSave = (existingName: string | null | undefined, nextName: string) =>
  (existingName ?? '').trim().length === 0 && nextName.trim().length === 0;

/**
 * Clearing a name that was on the square also clears its paid state, so the
 * open square does not stay "Blank · paid" or hand that payment to the next
 * name. A save that keeps or sets a name leaves the chosen payment alone.
 */
export const metaForSavedSquare = (
  existingName: string | null | undefined,
  nextName: string,
  meta: EntryMeta,
): EntryMeta => {
  if ((existingName ?? '').trim().length > 0 && nextName.trim().length === 0) {
    return { ...meta, paid_status: 'unknown' };
  }
  return meta;
};

/** Write one square's name (blank clears it), and optionally its availability. */
export const withSquareName = (
  board: BoardData,
  index: number,
  name: string,
  allocationLabel?: string | null,
  availability?: SquareAvailability,
): BoardData => {
  const squares = [...board.squares];
  squares[index] = name ? [name] : [];
  return {
    ...board,
    squares,
    ...(availability
      ? { availability: Array.from({ length: 100 }, (_, cell) => cell === index ? availability : board.availability?.[cell] ?? 'unspecified') }
      : {}),
    allocationLabels: Array.from({ length: 100 }, (_, cell) => cell === index
      ? allocationFor(board, cell, allocationLabel, name)
      : board.allocationLabels?.[cell] ?? null),
  };
};

/** Put one name on every listed square, keeping each square's seller label. */
export const withRangeAssigned = (board: BoardData, indices: readonly number[], name: string): Pick<BoardData, 'squares' | 'allocationLabels'> => {
  const chosen = new Set(indices);
  return {
    squares: board.squares.map((names, index) => (chosen.has(index) ? [name] : names)),
    allocationLabels: Array.from({ length: 100 }, (_, index) => chosen.has(index)
      ? allocationFor(board, index, null, name)
      : board.allocationLabels?.[index] ?? null),
  };
};

/** Set availability on the selected squares only. */
export const withAvailability = (board: BoardData, selection: ReadonlySet<number>, status: SquareAvailability): BoardData => ({
  ...board,
  availability: Array.from({ length: 100 }, (_, index) => selection.has(index) ? status : board.availability?.[index] ?? 'unspecified'),
});

export const availabilityNote = (count: number, status: SquareAvailability) =>
  `${count} ${count === 1 ? 'square' : 'squares'} ${status === 'available' ? 'offered as available' : status === 'unavailable' ? 'marked unavailable' : 'with availability label removed'}.`;

/**
 * Private notes for a range apply. `unknown` is the untouched default of the
 * payment radio group, not a decision, so it never erases a payment already on
 * file. A blank seller keeps the seller already on file.
 */
export const rangeEntryMeta = (
  indices: readonly number[],
  entryMeta: Record<number, EntryMeta>,
  input: { seller: string; paid: EntryMeta['paid_status'] },
): EntryMeta[] => indices.map((index) => {
  const existing = entryMeta[index];
  return {
    cell_index: index,
    paid_status: input.paid === 'unknown' ? existing?.paid_status ?? 'unknown' : input.paid,
    notify_opt_in: existing?.notify_opt_in ?? false,
    contact_type: existing?.contact_type ?? null,
    contact_value: existing?.contact_value ?? null,
    seller_label: input.seller.trim() || existing?.seller_label || null,
  };
});

/**
 * The next blank square after `index`. Deliberately does not wrap: past the
 * last open square there is nowhere forward to go, so the sheet closes.
 */
export const nextOpenAfter = (squares: string[][], index: number) => {
  for (let cursor = index + 1; cursor < squares.length; cursor += 1) {
    if (!squares[cursor]?.length) return cursor;
  }
  return null;
};

/** The board as the editor shows it for one period: that period's numbers on the axes. */
export const boardForPeriod = (board: BoardData, period: QuarterAxisKey): BoardData => ({
  ...board,
  topAxis: getAxisForQuarter(board, 'top', period),
  leftAxis: getAxisForQuarter(board, 'left', period),
});

export interface DrawPreview {
  top: number[];
  left: number[];
  /** Present only for boards with new numbers each quarter. */
  topSets?: QuarterAxes;
  leftSets?: QuarterAxes;
}

const shuffledSets = (): QuarterAxes => {
  const sets = {} as QuarterAxes;
  for (const key of QUARTER_KEYS) sets[key] = secureShuffleDigits();
  return sets;
};

/** A fresh draw: one set, or one set per quarter when the board changes numbers each quarter. */
export const buildDrawPreview = (perQuarter: boolean, shuffle: () => QuarterAxes = shuffledSets): DrawPreview => {
  if (!perQuarter) return { top: secureShuffleDigits(), left: secureShuffleDigits() };
  const topSets = shuffle();
  const leftSets = shuffle();
  return { top: topSets.Q1 as number[], left: leftSets.Q1 as number[], topSets, leftSets };
};

/** The digits the editor animates for the period on screen. */
export const drawPreviewForPeriod = (preview: DrawPreview | null, period: QuarterAxisKey) => {
  if (!preview) return null;
  if (!preview.topSets || !preview.leftSets) return { top: preview.top, left: preview.left };
  return { top: preview.topSets[period] as number[], left: preview.leftSets[period] as number[] };
};

/** Commit a staged draw onto the board. Open squares at draw time stay open by acknowledgement. */
export const withCommittedDraw = (board: BoardData, preview: DrawPreview, openCount: number): BoardData => ({
  ...board,
  topAxis: board.isDynamic ? board.topAxis : preview.top,
  leftAxis: board.isDynamic ? board.leftAxis : preview.left,
  isDynamic: board.isDynamic === true,
  allowOpenSquares: openCount > 0,
  leftAxisByQuarter: preview.leftSets ?? board.leftAxisByQuarter,
  topAxisByQuarter: preview.topSets ?? board.topAxisByQuarter,
});
