import { describe, expect, it } from 'vitest';
import { hasValidAxes, isValidAxis } from '../utils/boardValidation';

const axis = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('board axis validation', () => {
  it('accepts exact permutations of the digits 0 through 9', () => {
    expect(isValidAxis(axis)).toBe(true);
    expect(isValidAxis([...axis].reverse())).toBe(true);
  });

  it.each([
    null,
    '0,1,2,3,4,5,6,7,8,9',
    axis.slice(0, 9),
    [...axis, 10],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 8],
    [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [0, 1.5, 2, 3, 4, 5, 6, 7, 8, 9],
    [0, '1', 2, 3, 4, 5, 6, 7, 8, 9],
  ])('rejects an invalid axis: %j', (candidate) => {
    expect(isValidAxis(candidate)).toBe(false);
  });

  it('requires both board axes to be valid', () => {
    expect(hasValidAxes({ bearsAxis: axis, oppAxis: [...axis].reverse() })).toBe(true);
    expect(hasValidAxes({ bearsAxis: axis, oppAxis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })).toBe(false);
  });
});
