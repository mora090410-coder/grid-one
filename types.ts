
export interface Team {
  abbr: string;
  name: string;
}

export interface GameState {
  title: string;
  meta: string;
  leftAbbr: string;
  leftName: string;
  topAbbr: string;
  topName: string;
  dates: string;
  lockTitle: boolean;
  lockMeta: boolean;
  // Manual Score Overrides
  useManualScores?: boolean;
  manualLeftScore?: number; // legacy single-total entry (pre-quarter UI boards)
  manualTopScore?: number;  // legacy single-total entry (pre-quarter UI boards)
  manualQuarterScores?: {
    Q1: QuarterScores;
    Q2: QuarterScores;
    Q3: QuarterScores;
    Q4: QuarterScores;
    OT: QuarterScores;
  };
  manualPeriod?: number; // 1-4 = quarter, 5 = OT
  manualGameState?: 'pre' | 'in' | 'post';
  coverImage?: string; // Base64 image string for board cover
  payouts?: {
    Q1: number;
    Q2: number;
    Q3: number;
    Final: number;
  };
}

// Dynamic Board Support - Per-Quarter Axes
export type QuarterKey = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface QuarterAxes {
  Q1: (number | null)[];
  Q2: (number | null)[];
  Q3: (number | null)[];
  Q4: (number | null)[];  // Q4 is also used for Final score
}

export interface BoardData {
  bearsAxis: (number | null)[];   // Standard board (backward compatible)
  oppAxis: (number | null)[];     // Standard board (backward compatible)
  squares: string[][];

  // Dynamic board support (optional - defaults to standard)
  isDynamic?: boolean;
  bearsAxisByQuarter?: QuarterAxes;
  oppAxisByQuarter?: QuarterAxes;
}

export interface QuarterScores {
  left: number;
  top: number;
}

export interface LiveGameData {
  leftScore: number;
  topScore: number;
  quarterScores: {
    Q1: QuarterScores;
    Q2: QuarterScores;
    Q3: QuarterScores;
    Q4: QuarterScores;
    OT: QuarterScores;
  };
  clock: string;
  period: number;
  state: 'pre' | 'in' | 'post';
  detail: string;
  isOvertime: boolean;
  isManual?: boolean;
}

export interface WinnerHighlights {
  quarterWinners: Record<string, string>;
  currentLabel: string;
}

export interface EntryMeta {
  cell_index: number;
  paid_status: 'unknown' | 'unpaid' | 'paid';
  notify_opt_in: boolean;
  contact_type: 'sms' | 'email' | null;
  contact_value: string | null;
}

export interface PoolDataWrapper {
  id: string;
  game: GameState;
  board: BoardData;
  is_paid: boolean;
  is_owner: boolean;
}
