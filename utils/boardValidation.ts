import { BoardData } from '../types';

export const isValidAxis = (axis: unknown): axis is number[] =>
  Array.isArray(axis)
  && axis.length === 10
  && axis.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)
  && new Set(axis).size === 10;

export const hasValidAxes = (
  board: Pick<BoardData, 'bearsAxis' | 'oppAxis'>,
) => isValidAxis(board.bearsAxis) && isValidAxis(board.oppAxis);
