import { describe, expect, it } from 'vitest';
import { MONEY_BOUNDARY, PRICING, PRICING_SENTENCE } from '../../src/features/homepage/pricing';
import { DEMO_LABEL, demoBoard, demoLive, demoWinnerNow, demoWinnerSquares } from '../../src/features/homepage/demoData';

describe('pricing', () => {
  it('carries the three live tiers with exact detail strings', () => {
    expect(PRICING.map((t) => t.id)).toEqual(['free', 'gameday', 'org']);
    expect(PRICING[0].detail).toBe('1 published board per account per season');
    expect(PRICING[1].detail).toBe('$9.99 once for up to 5 published boards in the 2026 season');
    expect(PRICING[2].detail).toContain('$79 per season for up to 50 published boards');
    expect(PRICING[2].detail).toContain('organization naming, shared dashboard, and one organization receipt');
    expect(PRICING_SENTENCE).toBe('Your first published board is free. Game Day is $9.99 once for up to 5 published boards in the 2026 season. Organization is $79 per season for up to 50 published boards.');
    expect(MONEY_BOUNDARY).toBe('GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.');
  });
});

describe('demo data', () => {
  it('is labeled as a demo and the named winner really holds the current digits', () => {
    expect(DEMO_LABEL).toBe('Sample board — not a live game');
    const leftDigit = demoLive.leftScore % 10;
    const topDigit = demoLive.topScore % 10;
    const row = demoBoard.leftAxis.indexOf(leftDigit);
    const col = demoBoard.topAxis.indexOf(topDigit);
    expect(demoBoard.squares[row * 10 + col]).toEqual([demoWinnerNow]);
    expect(demoWinnerSquares).toContainEqual({ left: leftDigit, top: topDigit });
    expect(demoWinnerSquares.length).toBe(3);
    expect(demoBoard.squares.filter((s) => s[0] === 'OPEN').length).toBe(17);
    expect(demoBoard.squares.every((s) => s.length === 1)).toBe(true);
  });
});
