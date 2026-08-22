import type { BoardData, GameState, LiveGameData } from '../../../types';
import { getAxisForQuarter } from '../../../utils/winnerLogic';

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
  disclaimer: 'These are arithmetic score outcomes, not odds or predictions.';
}

export const quarterForLive = (live: LiveGameData | null): ViewerQuarter => {
  if (!live || live.period <= 1) return 'Q1';
  if (live.period === 2) return 'Q2';
  if (live.period === 3) return 'Q3';
  return 'Final';
};

export const playersForDigits = (
  board: BoardData,
  topDigit: number,
  leftDigit: number,
  quarter: ViewerQuarter,
): string[] => {
  const topAxis = getAxisForQuarter(board, 'top', quarter);
  const leftAxis = getAxisForQuarter(board, 'left', quarter);
  const col = topAxis.indexOf(topDigit);
  const row = leftAxis.indexOf(leftDigit);
  return col < 0 || row < 0 ? [] : (board.squares[row * 10 + col] || []);
};

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
  if (!live || status === 'final') {
    return {
      status,
      currentQuarter,
      scenarios: [],
      disclaimer: 'These are arithmetic score outcomes, not odds or predictions.',
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
    disclaimer: 'These are arithmetic score outcomes, not odds or predictions.',
  };
};
