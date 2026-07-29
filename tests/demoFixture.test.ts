import { describe, expect, it } from 'vitest';
import { SAMPLE_BOARD } from '../fixtures/sampleBoard.fixture';

describe('public demo fixture', () => {
  it('uses only explicit synthetic participant labels', () => {
    const labels = SAMPLE_BOARD.squares.flat();

    expect(labels).toHaveLength(100);
    expect(labels.every((label) => /^Demo Player \d{2}$/.test(label))).toBe(true);
    expect(new Set(labels).size).toBeLessThan(labels.length);
  });
});
