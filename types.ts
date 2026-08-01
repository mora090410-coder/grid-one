
export interface Team {
  abbr: string;
  name: string;
}

export type PayoutDescriptions = Partial<Record<'Q1' | 'HALF' | 'Q3' | 'FINAL' | 'notes', string>>;

export type ScheduledGameState = 'pre' | 'in' | 'post';

/** A provider-backed NFL event whose matchup and kickoff stay together. */
export interface ScheduledGame {
  id: string;
  kickoffAt: string;
  state: ScheduledGameState;
  season: number;
  week: number | string;
  homeTeam: Team;
  awayTeam: Team;
}

export interface GameState {
  title: string;
  meta: string;
  organizationDisplayName?: string;
  /** Permanent marker for completed-game synthetic scoring demonstrations. */
  scoreTestMode?: boolean;
  /** ESPN event id used for exact-event score lookups. */
  gameExternalId?: string;
  /** Canonical provider kickoff instant. */
  kickoffAt?: string;
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
  manualPeriod?: number; // 0 = scheduled, 1-4 = quarter, 5 = OT
  manualGameState?: 'pre' | 'in' | 'post';
  coverImage?: string; // Base64 image string for board cover
  payoutDescriptions?: PayoutDescriptions;
  scoreSnapshot?: LiveGameData | null;
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
  /** Explicit organizer opt-in recorded with a number draw that includes open squares. */
  allowOpenSquares?: boolean;

  // Dynamic board support (optional - defaults to standard)
  isDynamic?: boolean;
  bearsAxisByQuarter?: QuarterAxes;
  oppAxisByQuarter?: QuarterAxes;
  participants?: Array<{ id: string; displayName: string; publicLabel: string }>;
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
  sourceName?: string;
  sourceUrl?: string;
  sourceObservedAt?: string;
  retrievedAt?: string;
  staleAfter?: string;
  freshness?: 'fresh' | 'stale' | 'refreshing' | 'rejected' | 'offline';
  warning?: string;
}

export interface WinnerHighlights {
  quarterWinners: Record<string, string>;
  currentLabel: string;
}

export interface WinnerResolution {
  milestone: 'Q1' | 'Q2' | 'Q3' | 'FINAL';
  sideScore?: number;
  topScore?: number;
  sideDigit: number;
  topDigit: number;
  participantName: string | null;
  openSquare?: boolean;
  resolvedAt: string;
  resolutionVersion?: number;
  corrected?: boolean;
  correctedAt?: string | null;
  correctionReason?: string | null;
  versions?: Array<{
    resolutionVersion: number;
    sideScore: number;
    topScore: number;
    sideDigit: number;
    topDigit: number;
    participantName: string | null;
    openSquare?: boolean;
    resolvedAt: string;
    corrected: boolean;
    correctedAt?: string | null;
    correctionReason?: string | null;
  }>;
}

export interface PendingMilestone {
  milestone: 'Q1' | 'Q2' | 'Q3' | 'FINAL';
  sideScore: number;
  topScore: number;
  sideDigit: number;
  topDigit: number;
  stableSince: string;
  lastObservedAt: string;
  successfulReadCount: number;
}

export interface NotificationDeliveryIssue {
  id: string;
  notificationKind: 'winner' | 'correction_previous' | 'correction_current';
  milestone?: WinnerResolution['milestone'];
  attemptCount: number;
  error?: string | null;
  terminalAt: string;
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
