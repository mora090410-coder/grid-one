import type { BoardData, GameState, LiveGameData, PendingMilestone, WinnerHighlights, WinnerResolution } from '../../../types';
import { getAxisForQuarter } from '../../../utils/winnerLogic';
import { quarterForLive, type ViewerQuarter } from '../scenarios/scenarioModel';

export type ViewerBoardCellState = 'selected' | 'current' | 'resolved' | 'milestone' | 'pending' | 'open' | 'corrected' | 'scenario';

export interface ViewerBoardCellModel {
  id: string;
  rowIndex: number;
  colIndex: number;
  topDigit: number | null;
  sideDigit: number | null;
  names: string[];
  displayText: string;
  isOpen: boolean;
  states: ViewerBoardCellState[];
  ariaName: string;
}

export interface ViewerBoardGridModel {
  quarter: ViewerQuarter;
  topTeamName: string;
  sideTeamName: string;
  topAxis: (number | null)[];
  sideAxis: (number | null)[];
  cells: ViewerBoardCellModel[][];
}

export interface BuildBoardGridModelInput {
  board: BoardData;
  game: Pick<GameState, 'leftName' | 'leftAbbr' | 'topName' | 'topAbbr'>;
  live: LiveGameData | null;
  highlights: WinnerHighlights;
  winnerHistory: WinnerResolution[];
  pendingMilestones: PendingMilestone[];
  selectedPlayer: string;
  highlightedCoords: { left: number; top: number } | null;
  showOpenSquares: boolean;
}

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const cellDisplay = (names: string[], isOpen: boolean): string => {
  if (isOpen) return 'OPEN';
  if (names.length === 0) return '';
  if (names.length === 1) return initials(names[0]);
  return `${initials(names[0])}+${names.length - 1}`;
};

const digitKey = (topDigit: number | null, sideDigit: number | null) => `${topDigit ?? 'x'}:${sideDigit ?? 'x'}`;

const currentDigits = (live: LiveGameData | null) => {
  if (!live || live.state === 'pre') return null;
  return { topDigit: live.topScore % 10, sideDigit: live.leftScore % 10 };
};

const milestoneEntries = (highlights: WinnerHighlights): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  Object.entries(highlights.quarterWinners).forEach(([milestone, scoreKey]) => {
    const [top, side] = scoreKey.split('-');
    if (top === undefined || side === undefined) return;
    const key = `${top}:${side}`;
    map.set(key, [...(map.get(key) ?? []), milestone]);
  });
  return map;
};

const historyEntries = (winnerHistory: WinnerResolution[]): Map<string, WinnerResolution[]> => {
  const map = new Map<string, WinnerResolution[]>();
  winnerHistory.forEach((winner) => {
    const key = `${winner.topDigit}:${winner.sideDigit}`;
    map.set(key, [...(map.get(key) ?? []), winner]);
  });
  return map;
};

const pendingEntries = (pendingMilestones: PendingMilestone[]): Map<string, PendingMilestone[]> => {
  const map = new Map<string, PendingMilestone[]>();
  pendingMilestones.forEach((pending) => {
    const key = `${pending.topDigit}:${pending.sideDigit}`;
    map.set(key, [...(map.get(key) ?? []), pending]);
  });
  return map;
};

const pushState = (states: ViewerBoardCellState[], state: ViewerBoardCellState) => {
  if (!states.includes(state)) states.push(state);
};

const buildAriaName = ({
  names,
  isOpen,
  rowIndex,
  colIndex,
  topDigit,
  sideDigit,
  topTeamName,
  sideTeamName,
  states,
  milestones,
  winners,
  pending,
}: {
  names: string[];
  isOpen: boolean;
  rowIndex: number;
  colIndex: number;
  topDigit: number | null;
  sideDigit: number | null;
  topTeamName: string;
  sideTeamName: string;
  states: ViewerBoardCellState[];
  milestones: string[];
  winners: WinnerResolution[];
  pending: PendingMilestone[];
}) => {
  const label = names.length > 0 ? names.join(', ') : isOpen ? 'OPEN' : 'Unassigned';
  const parts = [
    label,
    `coordinate row ${rowIndex + 1} column ${colIndex + 1}`,
    `${topTeamName} top digit ${topDigit ?? 'unknown'}`,
    `${sideTeamName} side digit ${sideDigit ?? 'unknown'}`,
  ];
  if (states.includes('selected')) parts.push('selected player');
  if (states.includes('current')) parts.push('current result');
  milestones.forEach((milestone) => parts.push(`${milestone} milestone`));
  pending.forEach((item) => parts.push(`${item.milestone} pending confirmation`));
  winners.forEach((winner) => {
    const milestone = winner.milestone;
    parts.push(winner.corrected ? `corrected ${milestone} result` : `${milestone} resolved result`);
    if (winner.openSquare) parts.push('resolved OPEN square');
  });
  if (states.includes('scenario')) parts.push('scenario focus');
  return parts.join(', ');
};

export const buildBoardGridModel = ({
  board,
  game,
  live,
  highlights,
  winnerHistory,
  pendingMilestones,
  selectedPlayer,
  highlightedCoords,
  showOpenSquares,
}: BuildBoardGridModelInput): ViewerBoardGridModel => {
  const quarter = quarterForLive(live);
  const topTeamName = game.topName || game.topAbbr;
  const sideTeamName = game.leftName || game.leftAbbr;
  const topAxis = getAxisForQuarter(board, 'top', quarter).slice(0, 10);
  const sideAxis = getAxisForQuarter(board, 'left', quarter).slice(0, 10);
  const selected = selectedPlayer.trim();
  const current = currentDigits(live);
  const milestonesByDigit = milestoneEntries(highlights);
  const historyByDigit = historyEntries(winnerHistory);
  const pendingByDigit = pendingEntries(pendingMilestones);

  const cells = sideAxis.map((sideDigit, rowIndex) => topAxis.map((topDigit, colIndex) => {
    const names = board.squares[rowIndex * 10 + colIndex] ?? [];
    const isOpen = showOpenSquares && names.length === 0;
    const key = digitKey(topDigit, sideDigit);
    const milestones = milestonesByDigit.get(key) ?? [];
    const winners = historyByDigit.get(key) ?? [];
    const pending = pendingByDigit.get(key) ?? [];
    const states: ViewerBoardCellState[] = [];

    if (isOpen) pushState(states, 'open');
    if (selected && names.includes(selected)) pushState(states, 'selected');
    if (current && current.topDigit === topDigit && current.sideDigit === sideDigit) pushState(states, 'current');
    if (milestones.length > 0) pushState(states, 'milestone');
    if (winners.length > 0) pushState(states, 'resolved');
    if (pending.length > 0) pushState(states, 'pending');
    if (winners.some((winner) => winner.corrected)) pushState(states, 'corrected');
    if (highlightedCoords && highlightedCoords.top % 10 === topDigit && highlightedCoords.left % 10 === sideDigit) pushState(states, 'scenario');

    return {
      id: `viewer-cell-${rowIndex}-${colIndex}`,
      rowIndex,
      colIndex,
      topDigit,
      sideDigit,
      names,
      displayText: cellDisplay(names, isOpen),
      isOpen,
      states,
      ariaName: buildAriaName({ names, isOpen, rowIndex, colIndex, topDigit, sideDigit, topTeamName, sideTeamName, states, milestones, winners, pending }),
    };
  }));

  return { quarter, topTeamName, sideTeamName, topAxis, sideAxis, cells };
};
