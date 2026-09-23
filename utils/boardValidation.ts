import { BoardData } from '../types';
import { QUARTER_KEYS } from './quarterAxes';
import { photoOrientationResolved } from './photoOrientation';

export const isValidAxis = (axis: unknown): axis is number[] =>
  Array.isArray(axis)
  && axis.length === 10
  && axis.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)
  && new Set(axis).size === 10;

export const hasValidAxes = (
  board: Pick<BoardData, 'leftAxis' | 'topAxis' | 'isDynamic' | 'leftAxisByQuarter' | 'topAxisByQuarter' | 'scanReview'>,
) => photoOrientationResolved(board) && (board.isDynamic === true
  ? QUARTER_KEYS.every(key => isValidAxis(board.leftAxisByQuarter?.[key]) && isValidAxis(board.topAxisByQuarter?.[key]))
  : isValidAxis(board.leftAxis) && isValidAxis(board.topAxis));
