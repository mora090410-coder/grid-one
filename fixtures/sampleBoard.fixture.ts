import { BoardData } from '../types';

/**
 * Public demo fixture — intentionally synthetic and deterministic.
 * Repeated labels demonstrate Find My Squares without exposing real participants.
 */
const generateSyntheticSquares = (): string[][] =>
  Array.from({ length: 100 }, (_, index) => {
    const row = Math.floor(index / 10);
    const column = index % 10;
    const participant = ((row * 7 + column * 3) % 24) + 1;
    return [`Demo Player ${participant.toString().padStart(2, '0')}`];
  });

export const SAMPLE_BOARD: BoardData = {
  leftAxis: [7, 1, 8, 4, 6, 9, 2, 5, 0, 3],
  topAxis: [9, 4, 8, 6, 2, 0, 1, 7, 5, 3],
  squares: generateSyntheticSquares(),
};
