import type { BoardData, GameState, LiveGameData } from '../../../../types';
import { getAxisForQuarter } from '../../../../utils/winnerLogic';
import { hasValidAxes } from '../../../../utils/boardValidation';

export type ViewerQuarter = 'Q1' | 'Q2' | 'Q3' | 'Final';
export type ScenarioStatus = 'available' | 'last-known' | 'no-score' | 'final';

export const scoringEvents = [
  { label: 'Safety', points: 2 },
  { label: 'Field goal', points: 3 },
  { label: 'Touchdown', points: 6 },
  { label: 'TD + kick', points: 7 },
  { label: 'TD + two', points: 8 },
] as const;

export interface ViewerScenario {
  label: typeof scoringEvents[number]['label'];
  points: typeof scoringEvents[number]['points'];
  team: string;
  left: number;
  top: number;
  names: string[];
}

export interface ViewerScenarioModel {
  status: ScenarioStatus;
  currentQuarter: ViewerQuarter;
  scenarios: ViewerScenario[];
  lastKnownCheckedAt: string | null;
  disclaimer: 'Just math on the score. Not odds or predictions.';
}

export const quarterForLive = (live: LiveGameData | null): ViewerQuarter => {
  if (live?.state === 'post') return 'Final';
  if (!live || live.period <= 1) return 'Q1';
  if (live.period === 2) return 'Q2';
  if (live.period === 3) return 'Q3';
  return 'Final';
};

/** Board position (0–99) holding these digits in this quarter's numbers, or -1. */
export const squareIndexForDigits = (
  board: BoardData,
  topDigit: number,
  leftDigit: number,
  quarter: ViewerQuarter,
): number => {
  if (!hasValidAxes(board)) return -1;
  const col = getAxisForQuarter(board, 'top', quarter).indexOf(topDigit);
  const row = getAxisForQuarter(board, 'left', quarter).indexOf(leftDigit);
  return col < 0 || row < 0 ? -1 : row * 10 + col;
};

export const playersForDigits = (
  board: BoardData,
  topDigit: number,
  leftDigit: number,
  quarter: ViewerQuarter,
): string[] => {
  const index = squareIndexForDigits(board, topDigit, leftDigit, quarter);
  return index < 0 ? [] : (board.squares[index] || []);
};

/** The square the live score points at right now, or -1. */
export const currentSquareIndex = (live: LiveGameData | null, board: BoardData): number =>
  live ? squareIndexForDigits(board, live.topScore % 10, live.leftScore % 10, quarterForLive(live)) : -1;

const scenarioStatus = (live: LiveGameData | null): ScenarioStatus => {
  if (!live) return 'no-score';
  if (live.state === 'post') return 'final';
  if (live.freshness === 'stale' || live.freshness === 'offline') return 'last-known';
  return 'available';
};

export const buildScenarioModel = ({
  board,
  game,
  live,
}: {
  board: BoardData;
  game: Pick<GameState, 'leftAbbr' | 'topAbbr'>;
  live: LiveGameData | null;
}): ViewerScenarioModel => {
  const currentQuarter = quarterForLive(live);
  const status = scenarioStatus(live);
  const lastKnownCheckedAt = status === 'last-known' ? live?.retrievedAt || null : null;
  if (!live || status === 'final' || !hasValidAxes(board)) {
    return {
      status,
      currentQuarter,
      scenarios: [],
      lastKnownCheckedAt,
      disclaimer: 'Just math on the score. Not odds or predictions.',
    };
  }

  const scenarios = [
    ...scoringEvents.map((event) => {
      const left = (live.leftScore + event.points) % 10;
      const top = live.topScore % 10;
      const names = playersForDigits(board, top, left, currentQuarter);
      return { ...event, team: game.leftAbbr, left, top, names };
    }),
    ...scoringEvents.map((event) => {
      const left = live.leftScore % 10;
      const top = (live.topScore + event.points) % 10;
      const names = playersForDigits(board, top, left, currentQuarter);
      return { ...event, team: game.topAbbr, left, top, names };
    }),
  ];

  return {
    status,
    currentQuarter,
    scenarios,
    lastKnownCheckedAt,
    disclaimer: 'Just math on the score. Not odds or predictions.',
  };
};
