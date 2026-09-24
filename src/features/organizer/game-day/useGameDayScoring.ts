import { useEffect, useState } from 'react';
import type { GameState, LiveGameData, WinnerResolution } from '../../../../types';
import {
  EMPTY_MANUAL_SCORES,
  manualPeriodForState,
  seedManualScoreFromSnapshot,
  type ManualGameState,
  type ManualQuarterKey,
  type ManualScoreSide,
} from './manualScoringModel';
import {
  enableManualScoringOnServer,
  returnAutomaticScoringOnServer,
  saveManualScoreToServer,
} from '../services/game-day/manualScoreService';
import { publishMilestoneCorrectionToServer, type MilestoneCorrectionDraft } from '../services/corrections/milestoneCorrectionService';

export type ScoreSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Newest result per milestone. A correction the organizer just published has
 * a higher resolution version than a score poll that was already in flight,
 * so the poll must not put the old result back on screen.
 */
export const mergeWinnerHistory = (local: WinnerResolution[], server: WinnerResolution[]): WinnerResolution[] => {
  const version = (entry: WinnerResolution | undefined) => entry?.resolutionVersion ?? 0;
  const localByMilestone = new Map(local.map((entry) => [entry.milestone, entry]));
  const merged = server.map((entry) => {
    const mine = localByMilestone.get(entry.milestone);
    return mine && version(mine) > version(entry) ? mine : entry;
  });
  const serverMilestones = new Set(server.map((entry) => entry.milestone));
  return [...merged, ...local.filter((entry) => !serverMilestones.has(entry.milestone))];
};

interface GameDayScoringInput {
  activePoolId: string | null;
  game: GameState;
  setGame: (updater: (game: GameState) => GameState) => void;
  liveData: LiveGameData | null;
  winnerHistory: WinnerResolution[];
  onReload?: () => Promise<void> | void;
  onNote: (note: string | null) => void;
  onAlert: (alert: string | null) => void;
}

/**
 * Game-day score authority and corrections for a published board: switch
 * between automatic and manual scores, publish a manual score, and publish an
 * audited milestone correction.
 */
export function useGameDayScoring({ activePoolId, game, setGame, liveData, winnerHistory, onReload, onNote, onAlert }: GameDayScoringInput) {
  const [scoreSaveStatus, setScoreSaveStatus] = useState<ScoreSaveStatus>('idle');
  const [correctionHistory, setCorrectionHistory] = useState(winnerHistory);
  const [correctionDraft, setCorrectionDraft] = useState<MilestoneCorrectionDraft | null>(null);

  useEffect(() => {
    setCorrectionHistory((current) => mergeWinnerHistory(current, winnerHistory));
  }, [winnerHistory]);

  /** Runs one server step with the shared saving/error status and messages. */
  const run = async (step: () => Promise<void>, doneStatus: ScoreSaveStatus, doneNote: string, failure: string) => {
    if (!activePoolId) return;
    setScoreSaveStatus('saving');
    onAlert(null);
    try {
      await step();
      setScoreSaveStatus(doneStatus);
      onNote(doneNote);
    } catch (error) {
      setScoreSaveStatus('error');
      onAlert((error as { message?: string } | null)?.message || failure);
    }
  };

  const enableManualScoring = async () => {
    if (!activePoolId || game.useManualScores) return;
    await run(async () => {
      await enableManualScoringOnServer(activePoolId);
      setGame((current) => {
        const seed = seedManualScoreFromSnapshot(current.scoreSnapshot ?? liveData);
        return { ...current, useManualScores: true, scoreSnapshot: null, manualQuarterScores: seed.manualQuarterScores, manualPeriod: seed.manualPeriod, manualGameState: seed.manualGameState };
      });
      // Deliberately no reload: the seeded quarters live only in the local
      // draft until they are published, and a published board never goes
      // dirty, so re-adopting the server game here would wipe them back to 0.
    }, 'idle', 'Manual scoring is on. Enter the score, then publish it.', 'Manual scoring could not be enabled.');
  };

  const saveManualScore = async () => {
    if (!activePoolId) return;
    await run(async () => {
      const result = await saveManualScoreToServer(activePoolId, game);
      setGame((current) => ({ ...current, useManualScores: true, scoreSnapshot: result.score }));
      await onReload?.();
    }, 'saved', 'Manual score is live. Winners for completed quarters were updated once.', 'Unable to save the score.');
  };

  const enableAutomaticScoring = async () => {
    if (!activePoolId) return;
    await run(async () => {
      await returnAutomaticScoringOnServer(activePoolId);
      setGame((current) => ({ ...current, useManualScores: false, scoreSnapshot: null }));
      await onReload?.();
    }, 'idle', 'Automatic score checks are enabled.', 'Automatic scoring could not be enabled.');
  };

  const publishCorrection = async () => {
    if (!activePoolId || !correctionDraft) return;
    const draft = correctionDraft;
    await run(async () => {
      const result = await publishMilestoneCorrectionToServer(activePoolId, draft);
      if (Array.isArray(result.winnerHistory)) setCorrectionHistory(result.winnerHistory);
      setCorrectionDraft(null);
      await onReload?.();
    }, 'saved', 'Correction published. Both correction notices were queued for verified recipients.', 'The correction could not be published.');
  };

  const updateManualQuarter = (quarter: ManualQuarterKey, side: ManualScoreSide, value: number) => {
    setGame((current) => {
      const base = current.manualQuarterScores ?? EMPTY_MANUAL_SCORES;
      return { ...current, manualQuarterScores: { ...base, [quarter]: { ...base[quarter], [side]: Math.max(0, value) } } };
    });
  };

  const updateManualGameState = (state: ManualGameState) => {
    setGame((current) => ({
      ...current,
      manualGameState: state,
      manualPeriod: manualPeriodForState(state, current.manualPeriod, current.manualQuarterScores),
    }));
  };

  const updateManualPeriod = (period: number) => setGame((current) => ({ ...current, manualPeriod: period }));

  return {
    scoreSaveStatus,
    correctionHistory,
    correctionDraft,
    setCorrectionDraft,
    enableManualScoring,
    saveManualScore,
    enableAutomaticScoring,
    publishCorrection,
    updateManualQuarter,
    updateManualGameState,
    updateManualPeriod,
  };
}
