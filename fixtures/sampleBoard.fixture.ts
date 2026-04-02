import { BoardData } from '../types';

/**
 * Demo fixture — not production data.
 * Maps names from a physical photo transcription to board positions.
 */
const generateIndexedSquares = (opp: number[], bears: number[]): string[][] => {
  const grid: string[][] = Array(100).fill(null).map(() => []);
  const raw: Record<string, string[]> = {
    "9-7": ["Mastalski", "Carol N."], "4-7": ["Mora"], "8-7": ["Zappia"], "6-7": ["Winkoff"], "2-7": ["Diego"], "0-7": ["Nowicki"], "1-7": ["Mckernin"], "7-7": ["Rosenbaum"], "5-7": ["Moy"], "3-7": ["J. Danielson"],
    "9-1": ["Lefko"], "4-1": ["Mastalski", "Lauren B."], "8-1": ["Mora"], "6-1": ["Zappia"], "2-1": ["Lefko"], "0-1": ["Blastick"], "1-1": ["Nowicki"], "7-1": ["Mckernin"], "5-1": ["Rosenbaum"], "3-1": ["Moy"],
    "9-8": ["Burk"], "4-8": ["Lefko Dustin"], "8-8": ["Mastalski Jen Poskin"], "6-8": ["Mora"], "2-8": ["Zappia"], "0-8": ["Winkoff"], "1-8": ["Goetz"], "7-8": ["Nowicki"], "5-8": ["Mckernin"], "3-8": ["Rosenbaum"],
    "9-4": ["B. St. Clair"], "4-4": ["Lefko Dustin"], "8-4": ["Burk"], "6-4": ["Mastalski Rita M."], "2-4": ["Mora"], "0-4": ["Zappia"], "1-4": ["Winkoff"], "7-4": ["Redmond"], "5-4": ["Nowicki"], "3-4": ["Mckernin"],
    "9-6": ["Moy"], "4-6": ["St. Clair"], "8-6": ["Burk"], "6-6": ["Lefko Drew"], "2-6": ["Rubo"], "0-6": ["Heide"], "1-6": ["Zappia"], "7-6": ["Mastalski K & C Mast"], "5-6": ["Peffers"], "3-6": ["Nowicki"],
    "9-9": ["Rosenbaum"], "4-9": ["Moy"], "8-9": ["Valfre"], "6-9": ["Burk"], "2-9": ["Rademacher"], "0-9": ["McCarthy"], "1-9": ["Mora"], "7-9": ["Zappia"], "5-9": ["Lefko"], "3-9": ["Castillo"],
    "9-2": ["Mckernin"], "4-2": ["Rosenbaum"], "8-2": ["Moy"], "6-2": ["Valfre"], "2-2": ["Burk Matt B."], "0-2": ["Lefko Dustin"], "1-2": ["Mastalski Carol N."], "7-2": ["Mora"], "5-2": ["Zappia"], "3-2": ["Winkoff"],
    "9-5": ["Nowicki"], "4-5": ["Mckernin"], "8-5": ["Rosenbaum"], "6-5": ["Moy"], "2-5": ["St. Clair"], "0-5": ["Burk Henry E."], "1-5": ["Lefko Steve"], "7-5": ["Mastalski Grant B."], "5-5": ["Mora"], "3-5": ["Zappia"],
    "9-0": ["Travis"], "4-0": ["Nowicki"], "8-0": ["Mckernin"], "6-0": ["Rosenbaum"], "2-0": ["Moy"], "0-0": ["Vanda"], "1-0": ["Burk"], "7-0": ["Lefko Drew"], "5-0": ["Mastalski Rita M."], "3-0": ["Mora"],
    "9-3": ["Winkoff"], "4-3": ["Sanders"], "8-3": ["Nowicki"], "6-3": ["Mckernin"], "2-3": ["Lefko Rob"], "0-3": ["Moy"], "1-3": ["St. Clair"], "7-3": ["Burk"], "5-3": ["Rosenbaum"], "3-3": ["Mastalski Grant B."]
  };

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const topDigit = opp[c];
      const leftDigit = bears[r];
      const key = `${topDigit}-${leftDigit}`;
      if (raw[key]) {
        grid[r * 10 + c] = raw[key];
      }
    }
  }
  return grid;
};

export const SAMPLE_BOARD: BoardData = {
  bearsAxis: [7, 1, 8, 4, 6, 9, 2, 5, 0, 3],
  oppAxis: [9, 4, 8, 6, 2, 0, 1, 7, 5, 3],
  squares: generateIndexedSquares(
    [9, 4, 8, 6, 2, 0, 1, 7, 5, 3],
    [7, 1, 8, 4, 6, 9, 2, 5, 0, 3]
  )
};
