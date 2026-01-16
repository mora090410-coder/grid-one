
import { BoardData, Team } from './types';

export const NFL_TEAMS: Team[] = [
  { abbr: 'ARI', name: 'Arizona Cardinals' }, { abbr: 'ATL', name: 'Atlanta Falcons' },
  { abbr: 'BAL', name: 'Baltimore Ravens' }, { abbr: 'BUF', name: 'Buffalo Bills' },
  { abbr: 'CAR', name: 'Carolina Panthers' }, { abbr: 'CHI', name: 'Chicago Bears' },
  { abbr: 'CIN', name: 'Cincinnati Bengals' }, { abbr: 'CLE', name: 'Cleveland Browns' },
  { abbr: 'DAL', name: 'Dallas Cowboys' }, { abbr: 'DEN', name: 'Denver Broncos' },
  { abbr: 'DET', name: 'Detroit Lions' }, { abbr: 'GB', name: 'Green Bay Packers' },
  { abbr: 'HOU', name: 'Houston Texans' }, { abbr: 'IND', name: 'Indianapolis Colts' },
  { abbr: 'JAX', name: 'Jacksonville Jaguars' }, { abbr: 'KC', name: 'Kansas City Chiefs' },
  { abbr: 'LV', name: 'Las Vegas Raiders' }, { abbr: 'LAC', name: 'Los Angeles Chargers' },
  { abbr: 'LAR', name: 'Los Angeles Rams' }, { abbr: 'MIA', name: 'Miami Dolphins' },
  { abbr: 'MIN', name: 'Minnesota Vikings' }, { abbr: 'NE', name: 'New England Patriots' },
  { abbr: 'NO', name: 'New Orleans Saints' }, { abbr: 'NYG', name: 'New York Giants' },
  { abbr: 'NYJ', name: 'New York Jets' }, { abbr: 'PHI', name: 'Philadelphia Eagles' },
  { abbr: 'PIT', name: 'Pittsburgh Steelers' }, { abbr: 'SF', name: 'San Francisco 49ers' },
  { abbr: 'SEA', name: 'Seattle Seahawks' }, { abbr: 'TB', name: 'Tampa Bay Buccaneers' },
  { abbr: 'TEN', name: 'Tennessee Titans' }, { abbr: 'WAS', name: 'Washington Commanders' }
];

export const TEAM_THEMES: Record<string, { primary: string; secondary: string }> = {
  ARI: { primary: '#97233F', secondary: '#FFB612' },
  ATL: { primary: '#A71930', secondary: '#000000' },
  BAL: { primary: '#241773', secondary: '#000000' },
  BUF: { primary: '#00338D', secondary: '#C60C30' },
  CAR: { primary: '#0085CA', secondary: '#101820' },
  CHI: { primary: '#0B162A', secondary: '#C83803' },
  CIN: { primary: '#FB4F14', secondary: '#000000' },
  CLE: { primary: '#311D00', secondary: '#FF3C00' },
  DAL: { primary: '#003594', secondary: '#869397' },
  DEN: { primary: '#FB4F14', secondary: '#002244' },
  DET: { primary: '#0076B6', secondary: '#B0B7BC' },
  GB: { primary: '#203731', secondary: '#FFB612' },
  HOU: { primary: '#03202F', secondary: '#A71930' },
  IND: { primary: '#002C5F', secondary: '#A2AAAD' },
  JAX: { primary: '#006778', secondary: '#D7A22A' },
  KC: { primary: '#E31837', secondary: '#FFB81C' },
  LV: { primary: '#000000', secondary: '#A5ACAF' },
  LAC: { primary: '#0080C6', secondary: '#FFC20E' },
  LAR: { primary: '#003594', secondary: '#FFA300' },
  LA: { primary: '#003594', secondary: '#FFA300' }, // Alias
  MIA: { primary: '#008E97', secondary: '#FC4C02' },
  MIN: { primary: '#4F2683', secondary: '#FFC62F' },
  NE: { primary: '#002244', secondary: '#C60C30' },
  NO: { primary: '#D3BC8D', secondary: '#101820' },
  NYG: { primary: '#002244', secondary: '#A71930' },
  NYJ: { primary: '#125740', secondary: '#000000' },
  PHI: { primary: '#004C54', secondary: '#A5ACAF' },
  PIT: { primary: '#FFB612', secondary: '#101820' },
  SF: { primary: '#AA0000', secondary: '#B3995D' },
  SEA: { primary: '#002244', secondary: '#69BE28' },
  TB: { primary: '#D50A0A', secondary: '#34302B' },
  TEN: { primary: '#0C2340', secondary: '#4B92DB' },
  WAS: { primary: '#5A1414', secondary: '#FFB612' },
  WSH: { primary: '#5A1414', secondary: '#FFB612' } // Alias
};

/**
 * Migration helper to ensure the SAMPLE_BOARD matches the physical photo provided.
 * Maps names to position (rowIdx, colIdx) based on the axis digits in the image.
 */
const generateIndexedSquares = (opp: number[], bears: number[]): string[][] => {
  const grid: string[][] = Array(100).fill(null).map(() => []);
  // Source data from the physical photo transcription
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

// Empty board template for new pools (standard mode)
export const EMPTY_BOARD: BoardData = {
  bearsAxis: Array(10).fill(null),
  oppAxis: Array(10).fill(null),
  squares: Array(100).fill([]),
  isDynamic: false,
};

// Empty board template for dynamic mode (per-quarter axes)
export const EMPTY_DYNAMIC_BOARD: BoardData = {
  bearsAxis: Array(10).fill(null),
  oppAxis: Array(10).fill(null),
  squares: Array(100).fill([]),
  isDynamic: true,
  bearsAxisByQuarter: {
    Q1: Array(10).fill(null),
    Q2: Array(10).fill(null),
    Q3: Array(10).fill(null),
    Q4: Array(10).fill(null),
  },
  oppAxisByQuarter: {
    Q1: Array(10).fill(null),
    Q2: Array(10).fill(null),
    Q3: Array(10).fill(null),
    Q4: Array(10).fill(null),
  },
};
