import { describe, expect, it } from 'vitest';
import { BoardData, EntryMeta } from '../types';
import { getOrganizerProgress } from '../utils/organizerFlow';

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const boardWith = (assigned: number, axes: number[] = Array(10).fill(null)): BoardData => ({
  squares: Array.from({ length: 100 }, (_, index) => index < assigned ? ['Organizer'] : []),
  bearsAxis: axes,
  oppAxis: axes,
  isDynamic: false,
});
const paid = (count: number) => Object.fromEntries(
  Array.from({ length: count }, (_, index) => [
    index,
    { cell_index: index, paid_status: 'paid' } as EntryMeta,
  ]),
);

describe('organizer progress', () => {
  it.each([[0, 100], [99, 1]])('routes %i assigned squares to assignment', (assigned, open) => {
    const progress = getOrganizerProgress({
      board: boardWith(assigned),
      entryMetaByIndex: {},
      isPublished: false,
    });
    expect(progress).toMatchObject({ phase: 'fill', destination: 'assign', assigned, open });
    expect(progress.actionLabel).toBe(`Assign ${open} ${open === 1 ? 'square' : 'squares'}`);
  });

  it('routes a full board to draw even when payment review remains', () => {
    expect(getOrganizerProgress({
      board: boardWith(100),
      entryMetaByIndex: {},
      isPublished: false,
    })).toMatchObject({ phase: 'draw', destination: 'draw', paymentReviewCount: 100 });
  });

  it('keeps unique out-of-range axes in draw so UI and publish validation agree', () => {
    expect(getOrganizerProgress({
      board: boardWith(100, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      entryMetaByIndex: paid(100),
      isPublished: false,
    }).phase).toBe('draw');
  });

  it('routes a complete valid free board to Preview', () => {
    expect(getOrganizerProgress({
      board: boardWith(100, digits),
      entryMetaByIndex: paid(100),
      isPublished: false,
    })).toMatchObject({ phase: 'preview', destination: 'preview' });
  });

  it('prioritizes published game-day controls over private payment metadata', () => {
    expect(getOrganizerProgress({
      board: boardWith(100, digits),
      entryMetaByIndex: {},
      isPublished: true,
    })).toMatchObject({ phase: 'live', destination: 'scoring', paymentReviewCount: 100 });
  });

  it('counts payment review only for occupied squares', () => {
    expect(getOrganizerProgress({
      board: boardWith(2),
      entryMetaByIndex: paid(1),
      isPublished: false,
    }).paymentReviewCount).toBe(1);
  });
});
