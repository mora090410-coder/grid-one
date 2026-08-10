import { describe, it, expect } from 'vitest';
import { boardImageFilename } from '../utils/boardImage';
import { GameState } from '../types';

const game = (overrides: Partial<GameState> = {}): GameState => ({
  title: 'Booster Club Squares',
  meta: '',
  leftAbbr: 'CHI',
  leftName: 'Chicago Bears',
  topAbbr: 'GB',
  topName: 'Green Bay Packers',
  dates: 'Sun Sep 13',
  lockTitle: false,
  lockMeta: false,
  ...overrides,
});

describe('boardImageFilename', () => {
  it('names the file after the matchup so a saved board is identifiable', () => {
    expect(boardImageFilename(game())).toBe('gb-vs-chi-board.png');
  });

  it('marks the seller view so both exports can live in one folder', () => {
    expect(boardImageFilename(game(), 'sellers')).toBe('gb-vs-chi-board-sellers.png');
  });

  it('falls back when a board has no teams chosen yet', () => {
    expect(boardImageFilename(game({ leftAbbr: '', topAbbr: '' }))).toBe('away-vs-home-board.png');
  });

  it('strips characters that break share targets and filesystems', () => {
    const name = boardImageFilename(game({ topAbbr: 'N.Y./J', leftAbbr: 'L A' }));
    expect(name).toBe('n-y-j-vs-l-a-board.png');
    expect(name).toMatch(/^[a-z0-9-]+\.png$/);
  });
});
