import { describe, it, expect } from 'vitest';
import { BoardData, LiveGameData } from '../types';
import { calculateCurrentWinner, calculateWinnerHighlights, getAxisForQuarter } from '../utils/winnerLogic';

const makeBaseBoard = (): BoardData => ({
  bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  oppAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: Array(100).fill(null).map(() => []),
});

const makeLiveData = (overrides: Partial<LiveGameData> = {}): LiveGameData => ({
  leftScore: 17,
  topScore: 24,
  quarterScores: {
    Q1: { left: 3, top: 7 },
    Q2: { left: 7, top: 10 },
    Q3: { left: 0, top: 3 },
    Q4: { left: 7, top: 4 },
    OT: { left: 0, top: 0 },
  },
  clock: '00:00',
  period: 4,
  state: 'post',
  detail: 'Final',
  isOvertime: false,
  ...overrides,
});

describe('winnerLogic', () => {
  it('uses standard axis when board is not dynamic', () => {
    const board = makeBaseBoard();
    expect(getAxisForQuarter(board, 'left', 'Q2')).toEqual(board.bearsAxis);
    expect(getAxisForQuarter(board, 'top', 'Q3')).toEqual(board.oppAxis);
  });

  it('uses quarter-specific axis when board is dynamic', () => {
    const board = makeBaseBoard();
    board.isDynamic = true;
    board.bearsAxisByQuarter = {
      Q1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      Q2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
      Q3: [2, 3, 4, 5, 6, 7, 8, 9, 0, 1],
      Q4: [3, 4, 5, 6, 7, 8, 9, 0, 1, 2],
    };
    board.oppAxisByQuarter = {
      Q1: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
      Q2: [8, 7, 6, 5, 4, 3, 2, 1, 0, 9],
      Q3: [7, 6, 5, 4, 3, 2, 1, 0, 9, 8],
      Q4: [6, 5, 4, 3, 2, 1, 0, 9, 8, 7],
    };

    expect(getAxisForQuarter(board, 'left', 'Q2')).toEqual(board.bearsAxisByQuarter.Q2);
    expect(getAxisForQuarter(board, 'top', 'Final')).toEqual(board.oppAxisByQuarter.Q4);
  });

  it('calculates quarter winners and final winner from live scores', () => {
    const liveData = makeLiveData();
    const result = calculateWinnerHighlights(liveData);

    expect(result.currentLabel).toBe('FINAL');
    expect(result.quarterWinners.Q1).toBe('7-3');
    expect(result.quarterWinners.Q2).toBe('7-0');
    expect(result.quarterWinners.Q3).toBe('0-0');
    expect(result.quarterWinners.Final).toBe('4-7');
  });

  it('returns no quarter winners in manual mode', () => {
    const liveData = makeLiveData({ isManual: true, state: 'in', period: 2 });
    const result = calculateWinnerHighlights(liveData);
    expect(result.currentLabel).toBe('NOW');
    expect(result.quarterWinners).toEqual({});
  });

  it('resolves current winner owners from board coordinates', () => {
    const board = makeBaseBoard();
    const row = board.bearsAxis.indexOf(7);
    const col = board.oppAxis.indexOf(4);
    const index = row * 10 + col;
    board.squares[index] = ['Alice'];

    const current = calculateCurrentWinner(makeLiveData(), board);
    expect(current?.key).toBe('4-7');
    expect(current?.owners).toEqual(['Alice']);
    expect(current?.squareIndex).toBe(index);
  });
});
