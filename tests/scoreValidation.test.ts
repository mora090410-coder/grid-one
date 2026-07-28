import { describe, expect, it } from 'vitest';
import { toClientScore, validateScore } from '../functions/api/pools/[id]/score';

const valid = {
  leftScore: 17,
  topScore: 24,
  quarterScores: {
    Q1: { left: 3, top: 7 },
    Q2: { left: 7, top: 7 },
    Q3: { left: 7, top: 3 },
    Q4: { left: 0, top: 7 },
    OT: { left: 0, top: 0 },
  },
  clock: '2:31',
  period: 4,
  state: 'in',
  detail: 'Fourth quarter',
  isOvertime: false,
  sourceObservedAt: '2026-09-13T20:15:00.000Z',
};

describe('server score validation', () => {
  it('accepts a complete internally consistent NFL score snapshot', () => {
    expect(validateScore(valid)).toMatchObject({ leftScore: 17, topScore: 24, state: 'in' });
  });

  it('rejects quarter totals that do not match the game totals', () => {
    expect(() => validateScore({
      ...valid,
      leftScore: 18,
    })).toThrow(/quarter scoring/i);
  });

  it('rejects invalid game states and impossible score values', () => {
    expect(() => validateScore({ ...valid, state: 'live' })).toThrow(/game state/i);
    expect(() => validateScore({ ...valid, leftScore: -1 })).toThrow(/score totals/i);
  });

  it('marks an organizer snapshot as manual in the viewer projection', () => {
    const projected = toClientScore({
      side_score: 10,
      top_score: 7,
      quarter_scores: valid.quarterScores,
      clock: '',
      period: 2,
      game_state: 'in',
      detail: 'Organizer entry',
      source_mode: 'manual',
      source_name: 'Organizer',
      retrieved_at: '2026-09-13T20:15:00.000Z',
      stale_after: '2026-09-13T20:30:00.000Z',
    });
    expect(projected).toMatchObject({ isManual: true, sourceName: 'Organizer' });
  });
});
