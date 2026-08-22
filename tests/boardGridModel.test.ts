import { describe, expect, it } from 'vitest';
import { buildBoardGridModel } from '../features/viewer/board/boardGridModel';
import type { BoardData, GameState, LiveGameData, WinnerResolution } from '../types';

const game: Pick<GameState, 'leftName' | 'leftAbbr' | 'topName' | 'topAbbr'> = {
  leftName: 'Dallas Cowboys',
  leftAbbr: 'DAL',
  topName: 'Washington Commanders',
  topAbbr: 'WAS',
};

const live: LiveGameData = {
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
};

const board = (overrides: Partial<BoardData> = {}): BoardData => {
  const base: BoardData = {
    topAxis: [9, 4, 1, 7, 0, 8, 3, 6, 2, 5],
    leftAxis: [6, 2, 7, 1, 9, 4, 0, 5, 8, 3],
    squares: Array.from({ length: 100 }, () => []),
    allowOpenSquares: true,
  };
  base.squares[2 * 10 + 1] = ['Ann Lee']; // top 4 side 7
  base.squares[0] = ['Bo Park'];
  return { ...base, ...overrides };
};

describe('Slice 7 boardGridModel', () => {
  it('derives cells from the Slice 5 quarter axis helper instead of assuming 0-9 order', () => {
    const model = buildBoardGridModel({
      board: board(),
      game,
      live,
      highlights: { quarterWinners: {}, currentLabel: 'NOW' },
      winnerHistory: [],
      pendingMilestones: [],
      selectedPlayer: '',
      highlightedCoords: null,
      showOpenSquares: true,
    });

    expect(model.topAxis).toEqual([9, 4, 1, 7, 0, 8, 3, 6, 2, 5]);
    expect(model.sideAxis).toEqual([6, 2, 7, 1, 9, 4, 0, 5, 8, 3]);
    expect(model.cells[2][1]).toMatchObject({ rowIndex: 2, colIndex: 1, topDigit: 4, sideDigit: 7, names: ['Ann Lee'], isOpen: false });
    expect(model.cells[0][1]).toMatchObject({ topDigit: 4, sideDigit: 6, names: [], isOpen: true });
  });

  it('marks selection, current result, resolved milestones, OPEN, and corrections as distinct states in cell semantics', () => {
    const winnerHistory: WinnerResolution[] = [
      { milestone: 'Q1', topDigit: 7, sideDigit: 3, participantName: 'Chris Yu', resolvedAt: '2026-09-13T18:00:00.000Z' },
      { milestone: 'FINAL', topDigit: 4, sideDigit: 7, participantName: 'Ann Lee', corrected: true, correctionReason: 'Official score correction', resolvedAt: '2026-09-13T22:00:00.000Z', resolutionVersion: 2 },
    ];

    const model = buildBoardGridModel({
      board: board(),
      game,
      live,
      highlights: { quarterWinners: { Q3: '4-7' }, currentLabel: 'NOW' },
      winnerHistory,
      pendingMilestones: [{ milestone: 'Q3', topScore: 24, sideScore: 17, topDigit: 4, sideDigit: 7, stableSince: '', lastObservedAt: '', successfulReadCount: 2 }],
      selectedPlayer: 'Ann Lee',
      highlightedCoords: { top: 4, left: 7 },
      showOpenSquares: true,
    });

    const ann = model.cells[2][1];
    expect(ann.states).toEqual(expect.arrayContaining(['selected', 'current', 'resolved', 'milestone', 'pending', 'corrected', 'scenario']));
    expect(ann.ariaName).toContain('Ann Lee');
    expect(ann.ariaName).toContain('coordinate row 3 column 2');
    expect(ann.ariaName).toContain('top digit 4');
    expect(ann.ariaName).toContain('side digit 7');
    expect(ann.ariaName).toContain('current result');
    expect(ann.ariaName).toContain('Q3 milestone');
    expect(ann.ariaName).toContain('corrected FINAL result');

    const open = model.cells[0][1];
    expect(open.states).toContain('open');
    expect(open.ariaName).toContain('OPEN');
    expect(open.ariaName).toContain('top digit 4');
    expect(open.ariaName).toContain('side digit 6');
  });

  it('uses dynamic quarter axes only through getAxisForQuarter and preserves legacy BoardGrid dynamic behavior by not touching it', () => {
    const dynamic = board({
      isDynamic: true,
      topAxisByQuarter: {
        Q1: [0,1,2,3,4,5,6,7,8,9],
        Q2: [9,8,7,6,5,4,3,2,1,0],
        Q3: [1,3,5,7,9,0,2,4,6,8],
        Q4: [4,2,0,8,6,1,3,5,7,9],
      },
      leftAxisByQuarter: {
        Q1: [0,1,2,3,4,5,6,7,8,9],
        Q2: [9,8,7,6,5,4,3,2,1,0],
        Q3: [8,6,4,2,0,9,7,5,3,1],
        Q4: [7,5,3,1,9,6,4,2,0,8],
      },
    });

    const model = buildBoardGridModel({ board: dynamic, game, live, highlights: { quarterWinners: {}, currentLabel: 'NOW' }, winnerHistory: [], pendingMilestones: [], selectedPlayer: '', highlightedCoords: null, showOpenSquares: true });
    expect(model.quarter).toBe('Final');
    expect(model.topAxis).toEqual([4,2,0,8,6,1,3,5,7,9]);
    expect(model.sideAxis).toEqual([7,5,3,1,9,6,4,2,0,8]);
  });
});
