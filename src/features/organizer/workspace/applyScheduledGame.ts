import type { GameState, ScheduledGame } from '../../../../types';
import { matchupFromScheduledGame } from '../../../../utils/scheduledGame';

/**
 * Fold a picked provider game into the workspace draft.
 *
 * The axis mapping is the shared `matchupFromScheduledGame` rule used by board
 * creation and the server. Changing the matchup also invalidates every score fact the old
 * matchup left behind, so the manual/snapshot score state resets with it --
 * the same reset the pre-workspace admin panel performed.
 */
export const applyScheduledGame = (game: GameState, scheduled: ScheduledGame): GameState => ({
  ...game,
  ...matchupFromScheduledGame(scheduled),
  scoreSnapshot: null,
  useManualScores: false,
  manualQuarterScores: undefined,
  manualLeftScore: 0,
  manualTopScore: 0,
  manualPeriod: undefined,
  manualGameState: undefined,
});

export default applyScheduledGame;
