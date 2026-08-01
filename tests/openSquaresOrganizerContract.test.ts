import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { publishedOpenSquaresAreAssignable } from '../components/AdminPanel';

const source = readFileSync(resolve(process.cwd(), 'components/AdminPanel.tsx'), 'utf8');
const horizonSource = readFileSync(resolve(process.cwd(), 'components/GameDayHorizon.tsx'), 'utf8');

describe('open-square organizer UI contract', () => {
  it('requires an inline confirmation and persists the opt-in with the committed draw', () => {
    expect(source).toContain('Draw anyway?');
    expect(source).toContain('Draw with {openSquareCount} OPEN');
    expect(source).toContain('allowOpenSquares: openSquareCount > 0');
    expect(source).toContain('localBoard.allowOpenSquares && openSquareCount > 0');
    expect(source).toContain('? { allowOpenSquares: true }');
    expect(source).not.toContain('window.confirm');
  });

  it('keeps published occupied cells immutable and sends late fills through the dedicated callback', () => {
    expect(source).toContain('canFillPublishedOpenSquares && publishedOpenCell');
    expect(source).toContain('Published assignments cannot be changed. Select OPEN squares only.');
    expect(source).toContain('await onAssignOpenSquares(newBoard.squares)');
  });

  it('enables late fill only before kickoff on a published board with open inventory', () => {
    const kickoffAt = '2026-09-13T17:00:00.000Z';
    expect(publishedOpenSquaresAreAssignable({
      isPublished: true,
      openSquareCount: 6,
      kickoffAt,
      now: Date.parse('2026-09-13T16:59:59.000Z'),
    })).toBe(true);
    expect(publishedOpenSquaresAreAssignable({
      isPublished: true,
      openSquareCount: 6,
      kickoffAt,
      now: Date.parse(kickoffAt),
    })).toBe(false);
    expect(publishedOpenSquaresAreAssignable({
      isPublished: false,
      openSquareCount: 6,
      kickoffAt,
    })).toBe(false);
  });

  it('uses the persisted board flag for public OPEN rendering even when locked is false', () => {
    expect(horizonSource).toContain('board.allowOpenSquares === true');
    expect(horizonSource).toContain('showOpenSquares={showOpenSquares}');
  });
});
