import type { BoardData } from '../types';

export const QUARTER_KEYS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type QuarterAxisKey = typeof QUARTER_KEYS[number];
/** Matches paper boards: 1st, 2nd (halftime), 3rd, Final (includes overtime). */
export const QUARTER_LABELS = { Q1: '1st', Q2: '2nd', Q3: '3rd', Q4: 'Final' } as const;
export const quarterAxisKey = (period?: string): QuarterAxisKey | null => {
  if (period === 'Final' || period === 'OT') return 'Q4';
  return QUARTER_KEYS.includes(period as QuarterAxisKey) ? period as QuarterAxisKey : null;
};

/** Diagnostics describe literal input. They never repair or reorder it. */
export function axisIssues(axis: unknown) {
  const values: unknown[] = Array.isArray(axis) ? axis : [];
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9);
  const duplicates = [...new Set(known.filter((digit, index) => known.indexOf(digit) !== index))].sort((a,b) => a-b);
  const missing = Array.from({length:10}, (_, i) => i).filter(digit => !known.includes(digit));
  const unknown = Array.from({length: Math.max(10, values.length)}, (_, i) => i).filter(i => !Number.isInteger(values[i]) || Number(values[i]) < 0 || Number(values[i]) > 9);
  return { duplicates, missing, unknown, valid: values.length === 10 && !duplicates.length && !missing.length && !unknown.length };
}

/** Drafts permit nulls and duplicates; finalization does not. Missing legacy sets remain missing. */
export function validDraftAxisMode(board: { isDynamic?: unknown; leftAxisByQuarter?: unknown; topAxisByQuarter?: unknown; leftAxis?: unknown; topAxis?: unknown }): boolean {
  for (const axis of [board.leftAxis, board.topAxis]) {
    if (axis === undefined) continue;
    if (!Array.isArray(axis) || axis.length !== 10 || axis.some(digit => digit !== null && (!Number.isInteger(digit) || digit < 0 || digit > 9))) return false;
  }
  if (board.isDynamic !== undefined && typeof board.isDynamic !== 'boolean') return false;
  for (const sets of [board.leftAxisByQuarter, board.topAxisByQuarter]) {
    if (sets === undefined) continue;
    if (!sets || typeof sets !== 'object' || Array.isArray(sets)) return false;
    for (const [key, axis] of Object.entries(sets)) {
      if (!QUARTER_KEYS.includes(key as QuarterAxisKey) || !Array.isArray(axis) || axis.length !== 10 || axis.some(digit => digit !== null && (!Number.isInteger(digit) || digit < 0 || digit > 9))) return false;
    }
  }
  return true;
}

/** Public allowlist. No review/provider/private fields can ride along. */
export function projectQuarterAxes(board: Pick<BoardData, 'isDynamic' | 'leftAxisByQuarter' | 'topAxisByQuarter'>) {
  if (board.isDynamic !== true) return { isDynamic: false };
  const project = (sets: BoardData['topAxisByQuarter']) => Object.fromEntries(QUARTER_KEYS.map(key => [key, sets?.[key]?.slice()]));
  return { isDynamic: true, leftAxisByQuarter: project(board.leftAxisByQuarter), topAxisByQuarter: project(board.topAxisByQuarter) };
}
