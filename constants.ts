
import { BoardData, Team } from './types';
export { SAMPLE_BOARD } from './fixtures/sampleBoard.fixture';

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
