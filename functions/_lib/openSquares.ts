export class OpenSquaresValidationError extends Error {}

export const normalizeOpenSquareCells = (input: unknown): string[][] => {
  if (!Array.isArray(input) || input.length !== 100) {
    throw new OpenSquaresValidationError('The board must contain exactly 100 squares.');
  }

  return input.map((cell, index) => {
    if (!Array.isArray(cell) || cell.length > 1) {
      throw new OpenSquaresValidationError(
        `Square ${index + 1} must be open or contain exactly one purchaser name.`,
      );
    }
    if (cell.length === 0) return [];
    if (typeof cell[0] !== 'string') {
      throw new OpenSquaresValidationError(`Square ${index + 1} has an invalid purchaser name.`);
    }
    const displayName = cell[0].trim();
    if (!displayName || displayName.length > 80) {
      throw new OpenSquaresValidationError(
        `Square ${index + 1} purchaser name must contain 1 to 80 characters.`,
      );
    }
    return [displayName];
  });
};
