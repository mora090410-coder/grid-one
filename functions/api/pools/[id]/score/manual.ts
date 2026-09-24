import { adminClient, isUuid, maskedError, readJsonObject, requireUser, type PagesFunction } from '../../../../_lib/http';

type QuarterKey = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'OT';

const quarterKeys: QuarterKey[] = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'];
const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

const SCORE_SAVE_FAILED = 'The score could not be saved. Please try again.';
const SCORING_MODE_FAILED = 'The scoring mode could not be changed. Please try again.';

const authenticatedOwner = async (request: Request, env: any, contestId: string) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { error: json({ error: 'Manual scoring is not configured.' }, 503) };
  if (!isUuid(contestId)) return { error: json({ error: 'Invalid board ID.' }, 400) };
  const user = await requireUser(request, env, { missing: 'Sign in before changing a score.', expired: 'Your session has expired.' });
  if (user instanceof Response) return { error: user };
  const admin = adminClient(env);
  const { data: contest } = await admin
    .from('contests')
    .select('id, status, published_at, game_external_id')
    .eq('id', contestId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!contest) return { error: json({ error: 'Board not found.' }, 404) };
  if (!contest.published_at || !['published', 'live', 'final'].includes(contest.status)) {
    return { error: json({ error: 'Draw and lock the board numbers before managing scores.' }, 409) };
  }
  return { admin, user, contest };
};

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  const contestId = String(params.id || '');
  const owner = await authenticatedOwner(request, env, contestId);
  if (owner.error) return owner.error;
  const parsed = await readJsonObject(request, 16_384);
  if (parsed instanceof Response) return parsed;
  const body = parsed as {
    quarterScores?: Record<QuarterKey, { left: number; top: number }>;
    period?: number;
    state?: 'pre' | 'in' | 'post';
    clock?: string;
  };
  const period = Number(body.period);
  const state = body.state;
  if (!Number.isInteger(period) || period < 0 || period > 5 || !['pre', 'in', 'post'].includes(String(state))) {
    return json({ error: 'Choose a valid game status and period.' }, 400);
  }
  const quarterScores = {} as Record<QuarterKey, { left: number; top: number }>;
  for (const key of quarterKeys) {
    const left = Number(body.quarterScores?.[key]?.left);
    const top = Number(body.quarterScores?.[key]?.top);
    if (!Number.isInteger(left) || !Number.isInteger(top) || left < 0 || top < 0 || left > 99 || top > 99) {
      return json({ error: `Enter valid points for ${key}.` }, 400);
    }
    quarterScores[key] = { left, top };
  }
  const total = (side: 'left' | 'top') => quarterKeys.reduce((sum, key) => sum + quarterScores[key][side], 0);
  const hasOvertimeScore = quarterScores.OT.left > 0 || quarterScores.OT.top > 0;
  const effectivePeriod = state === 'post' ? (hasOvertimeScore ? 5 : 4) : period;
  const now = new Date();
  const admin = owner.admin!;
  const { data: committed, error: commitError } = await admin.rpc('gridone_commit_manual_score', {
    p_contest_id: contestId,
    p_owner_id: owner.user!.id,
    p_game_state: state,
    p_period: effectivePeriod,
    p_side_score: total('left'),
    p_top_score: total('top'),
    p_quarter_scores: quarterScores,
    p_clock: String(body.clock || '').slice(0, 32),
    p_observed_at: now.toISOString(),
  });
  if (commitError) return maskedError('Manual score commit failed', commitError, SCORE_SAVE_FAILED);
  const snapshot = Array.isArray(committed) ? committed[0] : committed;
  if (!snapshot?.id) return json({ error: 'The manual score was not committed.' }, 500);
  const publicScore = {
    leftScore: snapshot.side_score,
    topScore: snapshot.top_score,
    quarterScores: snapshot.quarter_scores,
    clock: snapshot.clock || '',
    period: snapshot.period,
    state: snapshot.game_state,
    detail: snapshot.detail,
    isOvertime: snapshot.period > 4,
    isManual: true,
    sourceName: 'Organizer',
    sourceObservedAt: snapshot.source_observed_at,
    retrievedAt: snapshot.retrieved_at,
    staleAfter: snapshot.stale_after,
    freshness: 'fresh',
  };
  const { data: milestoneProjection, error: projectionError } = await admin
    .from('public_board_snapshots')
    .select('winner_history, pending_milestones')
    .eq('contest_id', contestId)
    .maybeSingle();
  if (projectionError) return maskedError('Manual score projection read failed', projectionError, SCORE_SAVE_FAILED);
  return json({
    score: publicScore,
    winnerHistory: Array.isArray(milestoneProjection?.winner_history)
      ? milestoneProjection.winner_history
      : [],
    pendingMilestones: Array.isArray(milestoneProjection?.pending_milestones)
      ? milestoneProjection.pending_milestones
      : [],
  });
};

export const onRequestPut: PagesFunction = async ({ request, env, params }) => {
  const contestId = String(params.id || '');
  const owner = await authenticatedOwner(request, env, contestId);
  if (owner.error) return owner.error;
  const { data: enabled, error } = await owner.admin!.rpc('gridone_enable_manual_scoring', {
    p_contest_id: contestId,
    p_owner_id: owner.user!.id,
    p_changed_at: new Date().toISOString(),
  });
  if (error) return maskedError('Scoring mode change failed', error, SCORING_MODE_FAILED);
  if (!enabled) return json({ error: 'Manual scoring could not be enabled.' }, 409);
  return json({
    scoringMode: 'manual',
    scoreState: 'awaiting_organizer_entry',
    message: 'Manual scoring is on. Waiting for the organizer to enter a score.',
  });
};

export const onRequestDelete: PagesFunction = async ({ request, env, params }) => {
  const contestId = String(params.id || '');
  const owner = await authenticatedOwner(request, env, contestId);
  if (owner.error) return owner.error;
  if (!owner.contest?.game_external_id) {
    return json({
      error: 'Link this legacy board to a scheduled NFL game before enabling automatic scoring.',
    }, 409);
  }
  const { data: enabled, error } = await owner.admin!.rpc('gridone_enable_automatic_scoring', {
    p_contest_id: contestId,
    p_owner_id: owner.user!.id,
    p_changed_at: new Date().toISOString(),
  });
  if (error) return maskedError('Scoring mode change failed', error, SCORING_MODE_FAILED);
  if (!enabled) return json({ error: 'Automatic scoring could not be enabled.' }, 409);
  return json({ scoringMode: 'automatic' });
};
