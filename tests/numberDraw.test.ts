import { describe, expect, it } from 'vitest';
import { secureShuffleDigits } from '../components/AdminPanel';

describe('fixed-axis number draw', () => {
  it('always returns each digit exactly once', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const result = secureShuffleDigits();
      expect(result).toHaveLength(10);
      expect([...result].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });
});
