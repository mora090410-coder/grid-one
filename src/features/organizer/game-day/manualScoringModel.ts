import type { GameState, LiveGameData } from '../../../../types';

export type ManualQuarterScores = NonNullable<GameState['manualQuarterScores']>;
export type ManualGameState = NonNullable<GameState['manualGameState']>;
export type ManualQuarterKey = keyof ManualQuarterScores;
export type ManualScoreSide = 'left' | 'top';

export const EMPTY_MANUAL_SCORES: ManualQuarterScores = {
  Q1: { left: null, top: null },
  Q2: { left: null, top: null },
  Q3: { left: null, top: null },
  Q4: { left: null, top: null },
  OT: { left: null, top: null },
};

export const MANUAL_SCORE_PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const;

export const sanitizeManualScoreInput = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

export const manualPeriodForState = (
  state: ManualGameState,
  period: number | undefined,
  quarterScores: ManualQuarterScores | undefined,
) => {
  if (state === 'pre') return 0;
  if (state === 'post') {
    const hasOvertimeScore = Boolean(
      quarterScores && ((quarterScores.OT.left ?? 0) > 0 || (quarterScores.OT.top ?? 0) > 0),
    );
    return hasOvertimeScore || period === 5 ? 5 : 4;
  }
  return Math.min(5, Math.max(1, period ?? 1));
};

export const seedManualScoreFromSnapshot = (
  snapshot: LiveGameData | null | undefined,
) => {
  const state = snapshot?.state ?? 'in';
  const quarterScores = snapshot?.quarterScores ?? EMPTY_MANUAL_SCORES;
  return {
    manualGameState: state,
    manualPeriod: manualPeriodForState(state, snapshot?.period, quarterScores),
    manualQuarterScores: quarterScores,
  };
};

export const manualScoreTotal = (
  quarterScores: ManualQuarterScores | undefined,
  side: ManualScoreSide,
) => MANUAL_SCORE_PERIODS.reduce((sum, q) => sum + (quarterScores?.[q]?.[side] ?? 0), 0);

/** Quarters with either side still empty. Explicit 0 is an entered score. */
export const unenteredManualQuarters = (quarterScores: ManualQuarterScores | undefined) => (
  MANUAL_SCORE_PERIODS.filter((quarter) => (
    quarterScores?.[quarter]?.left == null || quarterScores?.[quarter]?.top == null
  ))
);
