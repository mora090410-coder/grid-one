import type { DraftSaveState, DraftSaveStatus } from '../draft/draftSaveModel';
import { QUARTER_KEYS } from '../../../../utils/quarterAxes';

export type OrganizerLifecyclePhase =
  | 'Create Draft'
  | 'Fill'
  | 'Reconcile'
  | 'Draw'
  | 'Preview'
  | 'Go Live'
  | 'Game Day'
  | 'Final Record';

export type LifecycleHardBlocker =
  | 'missing_owner'
  | 'missing_board_identity'
  | 'missing_scheduled_game'
  | 'invalid_board_shape'
  | 'duplicate_or_ambiguous_public_identity'
  | 'open_square_acknowledgement_required'
  | 'invalid_committed_axes'
  | 'dynamic_axes_not_supported'
  | `save_${DraftSaveStatus}`;

export type LifecycleAdvisory =
  | 'open_squares_remaining'
  | 'unpaid_or_unknown_payment_status'
  | 'seller_attribution_gaps';

export interface OrganizerAssignmentInput {
  publicLabel?: unknown;
  participantId?: unknown;
  paidStatus?: unknown;
  sellerLabel?: unknown;
  [key: string]: unknown;
}

export interface OrganizerLifecycleBoardInput {
  id?: unknown;
  ownerId?: unknown;
  title?: unknown;
  scheduledGame?: unknown;
  cells?: unknown;
  topAxis?: unknown;
  sideAxis?: unknown;
  isDynamic?: unknown;
  topAxisByQuarter?: unknown;
  leftAxisByQuarter?: unknown;
  openSquaresAcknowledged?: unknown;
  publishedAt?: unknown;
  gameState?: unknown;
  finalResolutionsComplete?: unknown;
}

export interface OrganizerLifecycleModel {
  phase: OrganizerLifecyclePhase;
  primaryAction: string;
  assignedCount: number;
  openCount: number;
  hardBlockers: LifecycleHardBlocker[];
  advisories: LifecycleAdvisory[];
  canEnterDraw: boolean;
  canPublish: boolean;
}

const exactDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Each digit 0-9 exactly once. Exported so the workspace gates on the same rule. */
export const isExactAxis = (axis: unknown): axis is number[] => Array.isArray(axis)
  && axis.length === 10
  && axis.every((value) => Number.isInteger(value) && exactDigits.includes(value as number))
  && new Set(axis).size === 10;

const isBlankAxis = (axis: unknown): boolean => Array.isArray(axis)
  && axis.length === 10
  && axis.every((value) => value === null);

const hasScheduledGame = (scheduledGame: unknown): boolean => isRecord(scheduledGame)
  && nonEmptyString(scheduledGame.id)
  && nonEmptyString(scheduledGame.kickoffAt);

const normalizeAssignment = (cell: unknown): OrganizerAssignmentInput | null => {
  if (cell === null || cell === undefined) return null;
  if (!isRecord(cell)) return null;
  return cell;
};

const publicLabelFor = (cell: OrganizerAssignmentInput): string | null => (
  nonEmptyString(cell.publicLabel) ? cell.publicLabel.trim() : null
);

const participantIdFor = (cell: OrganizerAssignmentInput): string | null => (
  nonEmptyString(cell.participantId) ? cell.participantId.trim() : null
);

const saveBlocker = (save: Pick<DraftSaveState, 'status' | 'revision'> | undefined): LifecycleHardBlocker | null => {
  if (!save?.status) return 'save_dirty';
  if (!Number.isInteger(save.revision) || save.revision < 0) return 'save_save_failed';
  if (save.status === 'clean') return null;
  return `save_${save.status}`;
};

export const evaluateOrganizerLifecycle = ({
  board,
  save,
  publishIntent = false,
}: {
  board: OrganizerLifecycleBoardInput | null | undefined;
  save?: Pick<DraftSaveState, 'status' | 'revision'>;
  publishIntent?: boolean;
}): OrganizerLifecycleModel => {
  const base = (phase: OrganizerLifecyclePhase, primaryAction: string, hardBlockers: LifecycleHardBlocker[] = []): OrganizerLifecycleModel => ({
    phase,
    primaryAction,
    assignedCount: 0,
    openCount: 100,
    hardBlockers,
    advisories: [],
    canEnterDraw: false,
    canPublish: false,
  });

  if (!board) return base('Create Draft', 'Create draft', []);
  if (!isRecord(board)) return base('Create Draft', 'Create draft', ['invalid_board_shape']);

  const hardBlockers: LifecycleHardBlocker[] = [];
  const advisories: LifecycleAdvisory[] = [];

  if (!nonEmptyString(board.id) || !nonEmptyString(board.title)) hardBlockers.push('missing_board_identity');
  if (!nonEmptyString(board.ownerId)) hardBlockers.push('missing_owner');
  if (!hasScheduledGame(board.scheduledGame)) hardBlockers.push('missing_scheduled_game');


  if (!Array.isArray(board.cells) || board.cells.length !== 100) {
    hardBlockers.push('invalid_board_shape');
    return {
      phase: 'Create Draft',
      primaryAction: 'Fix draft',
      assignedCount: 0,
      openCount: 100,
      hardBlockers,
      advisories,
      canEnterDraw: false,
      canPublish: false,
    };
  }

  const assignments = board.cells.map(normalizeAssignment);
  const assigned = assignments.filter((cell): cell is OrganizerAssignmentInput => Boolean(cell && publicLabelFor(cell))).length;
  const open = 100 - assigned;

  if (assigned === 0) {
    return {
      phase: 'Fill',
      primaryAction: 'Start assigning',
      assignedCount: 0,
      openCount: 100,
      hardBlockers,
      advisories: ['open_squares_remaining'],
      canEnterDraw: false,
      canPublish: false,
    };
  }

  if (open > 0) advisories.push('open_squares_remaining');
  if (open > 0 && board.openSquaresAcknowledged !== true) hardBlockers.push('open_square_acknowledgement_required');

  const labelToParticipantIds = new Map<string, Set<string>>();
  for (const cell of assignments) {
    if (!cell) continue;
    const label = publicLabelFor(cell);
    if (!label) continue;
    const id = participantIdFor(cell);
    const key = label.toLocaleLowerCase();
    if (!labelToParticipantIds.has(key)) labelToParticipantIds.set(key, new Set());
    labelToParticipantIds.get(key)?.add(id ?? '');
    if (cell.paidStatus !== 'paid') advisories.push('unpaid_or_unknown_payment_status');
    if (!nonEmptyString(cell.sellerLabel)) advisories.push('seller_attribution_gaps');
  }
  for (const ids of labelToParticipantIds.values()) {
    if (ids.has('') || ids.size > 1) hardBlockers.push('duplicate_or_ambiguous_public_identity');
  }

  const saveHardBlocker = saveBlocker(save);
  if (saveHardBlocker) hardBlockers.push(saveHardBlocker);

  const axes = board.isDynamic === true
    ? QUARTER_KEYS.flatMap(key => [isRecord(board.topAxisByQuarter) ? board.topAxisByQuarter[key] : undefined, isRecord(board.leftAxisByQuarter) ? board.leftAxisByQuarter[key] : undefined])
    : [board.topAxis, board.sideAxis];
  const axesReady = axes.every(isExactAxis);
  const axesBlank = axes.every(axis => axis === undefined || isBlankAxis(axis));
  if (!axesReady && !axesBlank) hardBlockers.push('invalid_committed_axes');

  const uniqueHardBlockers = [...new Set(hardBlockers)];
  const uniqueAdvisories = [...new Set(advisories)];
  const canEnterDraw = axesBlank && uniqueHardBlockers.length === 0;
  const canPublish = axesReady && uniqueHardBlockers.length === 0;

  let phase: OrganizerLifecyclePhase = 'Reconcile';
  let primaryAction = uniqueAdvisories.length ? 'Continue anyway' : 'Continue to draw';

  if (nonEmptyString(board.publishedAt)) {
    phase = board.gameState === 'post' && board.finalResolutionsComplete === true ? 'Final Record' : 'Game Day';
    primaryAction = phase === 'Final Record' ? 'Review final record' : 'Open game-day controls';
    return {
      phase,
      primaryAction,
      assignedCount: assigned,
      openCount: open,
      hardBlockers: uniqueHardBlockers.filter((blocker) => !String(blocker).startsWith('save_')),
      advisories: uniqueAdvisories,
      canEnterDraw: false,
      canPublish: false,
    };
  }

  if (canEnterDraw) {
    phase = 'Draw';
    primaryAction = 'Continue to draw';
  } else if (axesReady) {
    phase = publishIntent && canPublish ? 'Go Live' : 'Preview';
    primaryAction = publishIntent && canPublish ? 'Publish viewer link' : 'Review and publish';
  } else {
    phase = 'Reconcile';
    primaryAction = 'Review board';
  }

  return {
    phase,
    primaryAction,
    assignedCount: assigned,
    openCount: open,
    hardBlockers: uniqueHardBlockers,
    advisories: uniqueAdvisories,
    canEnterDraw,
    canPublish,
  };
};

export type OrganizerLifecycleEvent =
  | 'draft_created'
  | 'assignment_saved'
  | 'reviewed'
  | 'draw_committed'
  | 'previewed'
  | 'go_live_succeeded'
  | 'game_final';

const transitionMap: Partial<Record<OrganizerLifecyclePhase, Partial<Record<OrganizerLifecycleEvent, OrganizerLifecyclePhase>>>> = {
  'Create Draft': { draft_created: 'Fill' },
  Fill: { assignment_saved: 'Reconcile' },
  Reconcile: { reviewed: 'Draw' },
  Draw: { draw_committed: 'Preview' },
  Preview: { previewed: 'Go Live' },
  'Go Live': { go_live_succeeded: 'Game Day' },
  'Game Day': { game_final: 'Final Record' },
};

export const transitionOrganizerLifecycle = (
  phase: OrganizerLifecyclePhase,
  event: OrganizerLifecycleEvent | 'edit_setup',
): { ok: true; phase: OrganizerLifecyclePhase } | { ok: false; phase: OrganizerLifecyclePhase; reason: string } => {
  if ((phase === 'Game Day' || phase === 'Final Record') && event === 'go_live_succeeded') {
    return { ok: false, phase, reason: 'go_live_is_one_time' };
  }
  if ((phase === 'Game Day' || phase === 'Final Record') && event === 'edit_setup') {
    return { ok: false, phase, reason: 'published_setup_is_immutable' };
  }
  const next = transitionMap[phase]?.[event as OrganizerLifecycleEvent];
  if (!next) return { ok: false, phase, reason: 'impossible_transition' };
  return { ok: true, phase: next };
};

export interface PublicBoardSnapshot {
  title: string;
  scheduledGame: Record<string, unknown> | null;
  topAxis: unknown;
  sideAxis: unknown;
  cells: Array<{ publicLabel: string }>;
}

const publicTeam = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;
  const team: Record<string, string> = {};
  if (nonEmptyString(value.abbr)) team.abbr = value.abbr;
  if (nonEmptyString(value.name)) team.name = value.name;
  return Object.keys(team).length ? team : undefined;
};

const publicScheduledGame = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;
  const game: Record<string, unknown> = {};
  for (const key of ['id', 'kickoffAt', 'state'] as const) {
    if (nonEmptyString(value[key])) game[key] = value[key];
  }
  for (const key of ['season', 'week'] as const) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) game[key] = value[key];
  }
  const awayTeam = publicTeam(value.awayTeam);
  const homeTeam = publicTeam(value.homeTeam);
  if (awayTeam) game.awayTeam = awayTeam;
  if (homeTeam) game.homeTeam = homeTeam;
  return Object.keys(game).length ? game : null;
};

export const buildPublicBoardSnapshot = (board: OrganizerLifecycleBoardInput): PublicBoardSnapshot => {
  if (!isRecord(board) || !Array.isArray(board.cells) || board.cells.length !== 100) {
    return { title: '', scheduledGame: null, topAxis: [], sideAxis: [], cells: [] };
  }
  return {
    title: nonEmptyString(board.title) ? board.title : '',
    scheduledGame: publicScheduledGame(board.scheduledGame),
    topAxis: Array.isArray(board.topAxis) ? [...board.topAxis] : [],
    sideAxis: Array.isArray(board.sideAxis) ? [...board.sideAxis] : [],
    cells: board.cells.map((cell) => {
      const assignment = normalizeAssignment(cell);
      return { publicLabel: assignment ? publicLabelFor(assignment) ?? 'OPEN' : 'OPEN' };
    }),
  };
};
