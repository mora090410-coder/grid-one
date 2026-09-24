import { describe, expect, it } from 'vitest';
import type { BoardData, EntryMeta, QuarterAxes, WinnerResolution } from '../../types';
import {
  availabilityNote,
  boardForPeriod,
  buildDrawPreview,
  drawPreviewForPeriod,
  nextOpenAfter,
  openCountOf,
  rangeEntryMeta,
  withAvailability,
  withCommittedDraw,
  withRangeAssigned,
  withSquareName,
} from '../../src/features/organizer/workspace/workspaceBoardModel';
import {
  blockerMessage,
  canEnterDraw,
  draftPrimaryAction,
  gameDayPrimaryAction,
  lifecycleCells,
  publishBlocked,
} from '../../src/features/organizer/lifecycle/workspaceGates';
import { mergeWinnerHistory } from '../../src/features/organizer/game-day/useGameDayScoring';

const empty = (): BoardData => ({
  topAxis: Array(10).fill(null),
  leftAxis: Array(10).fill(null),
  squares: Array.from({ length: 100 }, () => []),
});

const digits = [3, 1, 4, 0, 5, 9, 2, 6, 8, 7];
const sets = (offset: number): QuarterAxes => ({
  Q1: digits.map((d) => (d + offset) % 10),
  Q2: digits.map((d) => (d + offset + 1) % 10),
  Q3: digits.map((d) => (d + offset + 2) % 10),
  Q4: digits.map((d) => (d + offset + 3) % 10),
});

describe('workspace board rules', () => {
  it('keeps a seller label on a square after a buyer name replaces the seller name', () => {
    const board = empty();
    board.squares[4] = ['Mora family'];
    const sold = withSquareName(board, 4, 'Dana Prince');
    expect(sold.squares[4]).toEqual(['Dana Prince']);
    expect(sold.allocationLabels?.[4]).toBe('Mora family');
    // A blank square with no label takes the offered seller label.
    expect(withSquareName(empty(), 7, 'Ann', 'Lee family').allocationLabels?.[7]).toBe('Lee family');
    // Clearing a name keeps the label, so the square stays that seller's.
    expect(withSquareName(sold, 4, '').squares[4]).toEqual([]);
    expect(withSquareName(sold, 4, '').allocationLabels?.[4]).toBe('Mora family');
  });

  it('writes availability only for the named square or the selection', () => {
    const one = withSquareName(empty(), 2, 'Ann', null, 'available');
    expect(one.availability?.[2]).toBe('available');
    expect(one.availability?.[3]).toBe('unspecified');
    expect(withSquareName(empty(), 2, 'Ann').availability).toBeUndefined();
    const many = withAvailability(empty(), new Set([1, 5]), 'unavailable');
    expect(many.availability?.filter((value) => value === 'unavailable')).toHaveLength(2);
    expect(availabilityNote(1, 'available')).toBe('1 square offered as available.');
    expect(availabilityNote(2, 'unspecified')).toBe('2 squares with availability label removed.');
  });

  it('assigns a range without touching other squares or existing seller labels', () => {
    const board = { ...empty(), allocationLabels: Array.from({ length: 100 }, (_, i) => (i === 10 ? 'Lee family' : null)) };
    const result = withRangeAssigned(board, [10, 11], 'Sam');
    expect(result.squares[10]).toEqual(['Sam']);
    expect(result.squares[12]).toEqual([]);
    expect(result.allocationLabels?.[10]).toBe('Lee family');
    expect(result.allocationLabels?.[11]).toBe('Sam');
  });

  it('never lets the untouched "unknown" payment choice erase a payment on file', () => {
    const meta: Record<number, EntryMeta> = {
      3: { cell_index: 3, paid_status: 'paid', notify_opt_in: true, contact_type: 'email', contact_value: 'a@b.co', seller_label: 'Lee family' },
    };
    const [kept, fresh] = rangeEntryMeta([3, 4], meta, { seller: '  ', paid: 'unknown' });
    expect(kept).toMatchObject({ paid_status: 'paid', notify_opt_in: true, contact_value: 'a@b.co', seller_label: 'Lee family' });
    expect(fresh).toMatchObject({ cell_index: 4, paid_status: 'unknown', seller_label: null });
    expect(rangeEntryMeta([3], meta, { seller: 'Mora', paid: 'unpaid' })[0]).toMatchObject({ paid_status: 'unpaid', seller_label: 'Mora' });
  });

  it('finds the next open square forward only', () => {
    const board = empty();
    board.squares[5] = ['Ann'];
    expect(nextOpenAfter(board.squares, 4)).toBe(6);
    const full = board.squares.map(() => ['x']);
    full[2] = [];
    expect(nextOpenAfter(full, 2)).toBeNull();
    expect(openCountOf(board)).toBe(99);
  });

  it("shows each period's own numbers and stages one set per quarter when the board uses them", () => {
    const board: BoardData = { ...empty(), isDynamic: true, topAxisByQuarter: sets(0), leftAxisByQuarter: sets(5) };
    expect(boardForPeriod(board, 'Q3').topAxis).toEqual(sets(0).Q3);
    expect(boardForPeriod(board, 'Q4').leftAxis).toEqual(sets(5).Q4);

    const single = buildDrawPreview(false);
    expect([...single.top].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(single.topSets).toBeUndefined();

    const perQuarter = buildDrawPreview(true, () => sets(1));
    expect(perQuarter.top).toEqual(sets(1).Q1);
    expect(drawPreviewForPeriod(perQuarter, 'Q2')).toEqual({ top: sets(1).Q2, left: sets(1).Q2 });
    expect(drawPreviewForPeriod(null, 'Q1')).toBeNull();
  });

  it('commits a draw without flattening quarter numbers into one set', () => {
    const dynamic: BoardData = { ...empty(), isDynamic: true };
    const committed = withCommittedDraw(dynamic, { top: digits, left: digits, topSets: sets(0), leftSets: sets(5) }, 3);
    expect(committed.topAxisByQuarter).toEqual(sets(0));
    expect(committed.topAxis).toEqual(dynamic.topAxis);
    expect(committed.allowOpenSquares).toBe(true);
    const fixed = withCommittedDraw(empty(), { top: digits, left: [...digits].reverse() }, 0);
    expect(fixed.topAxis).toEqual(digits);
    expect(fixed.isDynamic).toBe(false);
    expect(fixed.allowOpenSquares).toBe(false);
  });
});

describe('workspace gates', () => {
  it('lets the draw start with unsaved edits or the open-square question, but not a conflict or a real blocker', () => {
    expect(canEnterDraw({ hardBlockers: ['save_dirty', 'open_square_acknowledgement_required'] }, false)).toBe(true);
    expect(canEnterDraw({ hardBlockers: [] }, true)).toBe(false);
    expect(canEnterDraw({ hardBlockers: ['missing_scheduled_game'] }, false)).toBe(false);
  });

  it('holds publishing only for blockers the publish flow cannot resolve itself', () => {
    expect(publishBlocked({ hardBlockers: ['save_dirty'] })).toBe(false);
    expect(publishBlocked({ hardBlockers: ['invalid_committed_axes'] })).toBe(true);
    expect(blockerMessage('missing_board_identity')).toBe('Add a board name before publishing.');
    expect(blockerMessage(undefined)).toBeUndefined();
  });

  it('marks two different spellings of one identity as ambiguous', () => {
    const board = empty();
    board.squares[0] = ['Jose'];
    board.squares[1] = ['José'];
    board.squares[2] = ['Ann'];
    board.squares[3] = ['Ann'];
    const cells = lifecycleCells(board, {});
    expect(cells[0]?.participantId).toBeUndefined();
    expect(cells[1]?.participantId).toBeUndefined();
    expect(cells[2]?.participantId).toBe(cells[3]?.participantId);
    expect(cells[4]).toBeNull();
  });

  it('offers one next step in the draft workspace', () => {
    const base = { justPublished: false, assignedCount: 10, axesCommitted: false, isShared: false, drawAllowed: true };
    expect(draftPrimaryAction({ ...base, justPublished: true }).id).toBe('copy_link');
    expect(draftPrimaryAction({ ...base, assignedCount: 0 }).id).toBe('fill_board');
    expect(draftPrimaryAction({ ...base, axesCommitted: true, isShared: true }).label).toBe('Review game numbers');
    expect(draftPrimaryAction({ ...base, drawAllowed: false })).toEqual({ id: 'draw', label: 'Prepare to publish', disabled: true });
  });

  it('asks for attention on game day only for an untrusted score or a delivery issue', () => {
    expect(gameDayPrimaryAction({ scoreFreshness: 'stale', deliveryIssueCount: 2 })?.id).toBe('review_score');
    expect(gameDayPrimaryAction({ scoreFreshness: 'fresh', deliveryIssueCount: 1 })?.id).toBe('review_delivery');
    expect(gameDayPrimaryAction({ scoreFreshness: 'fresh', deliveryIssueCount: 0 })).toBeNull();
  });
});

describe('correction history', () => {
  const result = (milestone: WinnerResolution['milestone'], version: number, name: string): WinnerResolution => ({
    milestone, sideDigit: 1, topDigit: 2, participantName: name, resolvedAt: '2026-09-13T20:00:00Z', resolutionVersion: version,
  });

  it('keeps a just-published correction when an older score poll arrives', () => {
    const local = [result('Q1', 2, 'Corrected')];
    const staleServer = [result('Q1', 1, 'Original'), result('Q2', 1, 'Half')];
    expect(mergeWinnerHistory(local, staleServer).map((entry) => entry.participantName)).toEqual(['Corrected', 'Half']);
    const caughtUp = [result('Q1', 2, 'Corrected'), result('Q2', 1, 'Half')];
    expect(mergeWinnerHistory(local, caughtUp)).toEqual(caughtUp);
  });
});
