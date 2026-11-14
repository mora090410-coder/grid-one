import { describe, expect, it } from 'vitest';
import {
  CANDIDATES, CHAPTERS, KEYFRAMES, LEFT_AXIS, NOW_SQUARE, RESULTS, SQUARES, TOP_AXIS,
  boardMode, cardVisibility, goldSquares, nextScoreSquares, pickAnswer, progressFromScroll, squareFor,
} from '../../src/features/homepage/cinematic/cinematicModel';

describe('cinematic homepage model', () => {
  it('uses ten unique digits on each side and lands each sample result on the right square', () => {
    expect(new Set(TOP_AXIS).size).toBe(10);
    expect(new Set(LEFT_AXIS).size).toBe(10);
    for (const [kc, phi, square] of [[3, 7, RESULTS.Q1], [10, 7, RESULTS.Q2], [17, 14, RESULTS.Q3], [20, 24, RESULTS.Final]] as const) {
      const index = squareFor(kc, phi);
      expect(index).toBe(square);
      expect(LEFT_AXIS[Math.floor(index / 10)]).toBe(kc % 10);
      expect(TOP_AXIS[index % 10]).toBe(phi % 10);
    }
    expect(SQUARES[RESULTS.Q3]).toBe('Taylor M.');
    expect(SQUARES[RESULTS.Final]).toBe('Priya S.');
  });

  it('finds next-score squares by arithmetic, excluding the current square', () => {
    const map = nextScoreSquares(17, 14);
    expect(map.has(NOW_SQUARE)).toBe(false);
    for (const [index, scenarios] of map) for (const s of scenarios) {
      expect(squareFor(s.kc, s.phi)).toBe(index);
      expect([17 + (s.team === 'KC' ? s.points : 0), 14 + (s.team === 'PHI' ? s.points : 0)]).toEqual([s.kc, s.phi]);
    }
    const fieldGoal = [...map.values()].flat().find(s => s.team === 'KC' && s.points === 3)!;
    expect([fieldGoal.kc, fieldGoal.phi]).toEqual([20, 14]);
    expect(CANDIDATES.size).toBe(map.size);
  });

  it('answers a tapped square truthfully', () => {
    expect(pickAnswer(NOW_SQUARE)).toMatchObject({ name: 'Taylor M.', matchesNow: true });
    const [index] = [...CANDIDATES.keys()];
    expect(pickAnswer(index).answer).toMatch(/makes it \d+–\d+\. This square matches\./);
    const far = Array.from({ length: 100 }, (_, i) => i).find(i => i !== NOW_SQUARE && !CANDIDATES.has(i))!;
    expect(pickAnswer(far).answer).toMatch(/No single next score gets there from 17–14\./);
    expect(pickAnswer(far).answer).not.toMatch(/odds|likely|chance/i);
  });

  it('maps scroll to hero, six chapters, then holds', () => {
    const layout = { stageTop: 0, filmTop: 900, filmEnd: 6000 };
    expect(progressFromScroll(0, layout)).toBe(0);
    expect(progressFromScroll(450, layout)).toBeCloseTo(0.5);
    expect(progressFromScroll(900, layout)).toBe(1);
    expect(progressFromScroll(6000, layout)).toBe(6);
    expect(progressFromScroll(9000, layout)).toBe(6);
  });

  it('shows one chapter card at a time', () => {
    for (let k = 1; k <= 6; k++) {
      const shown = CHAPTERS.map((_, index) => cardVisibility(k, index + 1).opacity);
      expect(shown.filter(opacity => opacity > 0)).toEqual([1]);
    }
  });

  it('keeps gold to matching and result squares', () => {
    expect(goldSquares(boardMode(0))).toEqual([NOW_SQUARE]);
    expect(goldSquares(boardMode(2))).toEqual([]);
    expect(goldSquares(boardMode(4))).toEqual([NOW_SQUARE]);
    expect(goldSquares(boardMode(6))).toEqual([RESULTS.Q1, RESULTS.Q2, RESULTS.Q3, RESULTS.Final]);
    expect(KEYFRAMES).toHaveLength(CHAPTERS.length + 1);
  });
});
