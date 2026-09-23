import { describe, expect, it } from 'vitest';
import { hasValidAxes } from '../utils/boardValidation';
import { getAxisForQuarter, calculateCurrentWinner } from '../utils/winnerLogic';
import { axisIssues, quarterAxisKey } from '../utils/quarterAxes';
import type { BoardData, LiveGameData } from '../types';

const digits = [0,1,2,3,4,5,6,7,8,9];
const sets = { Q1: digits, Q2: [...digits.slice(1), 0], Q3: [...digits.slice(2), 0, 1], Q4: [...digits].reverse() };
const board = (): BoardData => ({ squares: Array.from({length:100}, (_, i) => [`Square ${i + 1}`]), leftAxis: digits, topAxis: digits, isDynamic: true, leftAxisByQuarter: structuredClone(sets), topAxisByQuarter: structuredClone(sets) });
describe('quarter-specific axes — literal review and single-square settlement', () => {
  it('requires all eight permutations, not a valid fixed fallback', () => {
    const value = board();
    expect(hasValidAxes(value)).toBe(true);
    value.topAxisByQuarter!.Q3 = [9,2,6,0,7,4,5,8,0,9];
    expect(hasValidAxes(value)).toBe(false);
    expect(axisIssues(value.topAxisByQuarter!.Q3)).toEqual({ duplicates: [0,9], missing: [1,3], unknown: [], valid: false });
  });
  it('never substitutes fixed axes for a missing period', () => {
    const value = board();
    delete (value.topAxisByQuarter as Partial<typeof sets>).Q2;
    expect(getAxisForQuarter(value, 'top', 'Q2')).toEqual(Array(10).fill(null));
    expect(getAxisForQuarter(value, 'top')).toEqual(Array(10).fill(null));
  });
  it('uses the fourth set for Final and overtime', () => {
    expect(quarterAxisKey('OT')).toBe('Q4');
    expect(getAxisForQuarter(board(), 'top', 'Final')).toEqual(sets.Q4);
    expect(getAxisForQuarter(board(), 'top', 'OT')).toEqual(sets.Q4);
  });
  it('does not award the first occurrence of a duplicate digit', () => {
    const value = board();
    value.topAxisByQuarter!.Q1 = [9,2,6,0,7,4,5,8,0,9];
    expect(calculateCurrentWinner({ topScore: 9, leftScore: 0, period: 1, state: 'in' } as LiveGameData, value)).toBeNull();
  });
  it('keeps fixed boards unchanged', () => {
    const value = {...board(), isDynamic: false};
    expect(getAxisForQuarter(value, 'top', 'Q3')).toEqual(digits);
    expect(hasValidAxes(value)).toBe(true);
  });
});
