import { validDraftAxisMode } from '../../utils/quarterAxes';

export const validateParticipation = (board: Record<string, unknown>): string | null => {
  if (!validDraftAxisMode(board)) return 'Invalid number mode or quarter axis shape.';
  if (board.availability !== undefined && (!Array.isArray(board.availability) || board.availability.length !== 100 || board.availability.some(value => !['unspecified', 'available', 'unavailable'].includes(value)))) return 'Availability must contain exactly 100 valid statuses.';
  if (board.participation !== undefined) {
    const details = board.participation;
    if (!details || typeof details !== 'object' || Array.isArray(details)) return 'Public instructions must be an object.';
    const limits: Record<string, number> = { purpose: 280, instructions: 500, squarePrice: 40 };
    for (const [key, value] of Object.entries(details)) {
      if (!Object.hasOwn(limits, key) || typeof value !== 'string' || value.length > limits[key]) return 'Public instructions must use bounded text.';
    }
  }
  return null;
};

/** Explicit public allocation labels are separate from the organizer's private ledger. */
export const validateAllocationLabels = (value: unknown): string | null => {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length !== 100) return 'Public allocations must contain exactly 100 square labels.';
  if (value.some(label => label !== null && (
    typeof label !== 'string' || label.length < 1 || label.length > 80 || label.trim() !== label
  ))) return 'Each public allocation must be null or a trimmed label of 1–80 characters.';
  return null;
};

export const validateSalesBoard = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'The board must contain exactly 100 squares.';
  const board = value as Record<string, unknown>;
  if (!validDraftAxisMode(board)) return 'Invalid number mode or quarter axis shape.';
  if (!Array.isArray(board.squares) || board.squares.length !== 100) return 'The board must contain exactly 100 squares.';
  if (board.squares.some(cell => !Array.isArray(cell) || cell.length > 1 || cell.some(name => (
    typeof name !== 'string' || name.length < 1 || name.length > 80 || name.trim() !== name
  )))) return 'Each square must be blank or contain one trimmed buyer name of 1–80 characters.';
  return validateAllocationLabels(board.allocationLabels) || validateParticipation(board);
};

export const projectSalesBoard = (board: Record<string, any>) => ({
  availability: board.availability ? [...board.availability] : Array(100).fill('unspecified'),
  participation: Object.fromEntries(['purpose', 'instructions', 'squarePrice'].filter(key => typeof board.participation?.[key] === 'string').map(key => [key, board.participation[key]])),
  squares: board.squares.map((names: string[]) => [...names]),
  allocationLabels: board.allocationLabels ? [...board.allocationLabels] : Array(100).fill(null),
  leftAxis: Array(10).fill(null),
  topAxis: Array(10).fill(null),
  isDynamic: board.isDynamic === true,
});

/** Only explicitly shared, still-unfinalized boards qualify; never reuse for scoring/email. */
export const findVisibleSalesBoard = async (admin: any, shareCode: string) => {
  const { data, error } = await admin.from('contests')
    .select('share_code, title, revision, shared_at, published_at, updated_at, board_data, game_external_id, game_starts_at, side_team_name, side_team_abbr, top_team_name, top_team_abbr')
    .eq('share_code', shareCode)
    .not('shared_at', 'is', null)
    .is('published_at', null)
    .in('status', ['draft', 'reconciling', 'ready'])
    .maybeSingle();
  if (error) throw error;
  // Check again so malformed or incomplete legacy data fails closed.
  if (!data?.shared_at || data.published_at || validateSalesBoard(data.board_data)) return null;
  return {
    share_code: data.share_code,
    title: data.title,
    revision: data.revision,
    shared_at: data.shared_at,
    published_at: null,
    updated_at: data.updated_at,
    stage: 'selling',
    leftAbbr: data.side_team_abbr,
    leftName: data.side_team_name,
    topAbbr: data.top_team_abbr,
    topName: data.top_team_name,
    gameExternalId: data.game_external_id,
    gameStartsAt: data.game_starts_at,
    kickoffAt: data.game_starts_at,
    dates: data.game_starts_at?.slice(0, 10),
    board: projectSalesBoard(data.board_data),
    score: null,
    winner_history: [],
    pending_milestones: [],
    payoutDescriptions: {},
    is_activated: true,
    locked: false,
  };
};
