import { describe, expect, it } from 'vitest';
import {
  manualPeriodForState,
  seedManualScoreFromSnapshot,
} from '../components/AdminPanel';
import type { LiveGameData } from '../types';

const quarterScores = {
  Q1: { left: 3, top: 0 },
  Q2: { left: 6, top: 0 },
  Q3: { left: 3, top: 0 },
  Q4: { left: 17, top: 13 },
  OT: { left: 0, top: 0 },
};

const snapshot = (overrides: Partial<LiveGameData> = {}): LiveGameData => ({
  leftScore: 29,
  topScore: 13,
  quarterScores,
  clock: '0:00',
  period: 4,
  state: 'post',
  detail: 'Final',
  isOvertime: false,
  ...overrides,
});

describe('manual scoring UI state', () => {
  it('seeds a manual override from the last valid provider snapshot', () => {
    expect(seedManualScoreFromSnapshot(snapshot())).toEqual({
      manualGameState: 'post',
      manualPeriod: 4,
      manualQuarterScores: quarterScores,
    });
  });

  it('uses period zero for scheduled games and clamps live periods', () => {
    expect(manualPeriodForState('pre', 4, quarterScores)).toBe(0);
    expect(manualPeriodForState('in', 0, quarterScores)).toBe(1);
    expect(manualPeriodForState('in', 9, quarterScores)).toBe(5);
  });

  it('distinguishes regulation finals from overtime finals', () => {
    expect(manualPeriodForState('post', 1, quarterScores)).toBe(4);
    expect(manualPeriodForState('post', 5, quarterScores)).toBe(5);
    expect(manualPeriodForState('post', 4, {
      ...quarterScores,
      OT: { left: 3, top: 0 },
    })).toBe(5);
  });

  it('preserves an overtime provider snapshot when entering manual mode', () => {
    const overtime = snapshot({
      leftScore: 32,
      period: 5,
      isOvertime: true,
      quarterScores: {
        ...quarterScores,
        OT: { left: 3, top: 0 },
      },
    });

    expect(seedManualScoreFromSnapshot(overtime)).toMatchObject({
      manualGameState: 'post',
      manualPeriod: 5,
      manualQuarterScores: overtime.quarterScores,
    });
  });
});
