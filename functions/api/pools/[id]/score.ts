import { createClient } from '@supabase/supabase-js';
import {
  findVisiblePublicBoard,
  publicBoardNotFoundResponse,
} from '../../../_lib/publicBoardVisibility';
import { hasBoardActivation } from '../../../../utils/boardActivation';
import {
  applyProviderScore,
  fetchExactEventScore,
  liveScoringEnabled,
  scorePollSeconds,
} from '../../../_lib/scoreRefresh';

// Re-exported for existing consumers and tests; implementations now live in
// the shared refresh library so the cron endpoint uses the exact same logic.
export {
  fetchExactEventScore,
  scoreStaleAfter,
  validateScore,
} from '../../../_lib/scoreRefresh';

type PagesFunction = (context: any) => Promise<Response> | Response;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sharePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

// How long past stale_after the anonymous share-code path tolerates before it
// falls back to an inline ESPN refresh. The cron normally keeps snapshots
// fresh; this only fires when the cron has stumbled for several minutes.
const PUBLIC_REFRESH_GRACE_MS = 5 * 60_000;
const PUBLIC_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=60';

export const hasActivatedBoardServices = (contest: { board_activations?: unknown } | null | undefined) =>
  hasBoardActivation(contest?.board_activations);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const readMilestoneProjection = async (admin: any, contestId: string) => {
  const { data, error } = await admin
    .from('public_board_snapshots')
    .select('winner_history, pending_milestones')
    .eq('contest_id', contestId)
    .maybeSingle();
  if (error) {
    console.error('Milestone projection read failed:', error);
    return { winnerHistory: [], pendingMilestones: [] };
  }
  return {
    winnerHistory: Array.isArray(data?.winner_history) ? data.winner_history : [],
    pendingMilestones: Array.isArray(data?.pending_milestones) ? data.pending_milestones : [],
  };
};

export const pendingMilestoneConfirmationDue = (
  pendingMilestones: any[],
  now = Date.now(),
) => pendingMilestones.some((pending: any) => {
  if (pending.milestone === 'FINAL') return false;
  const observedAt = new Date(
    pending.lastObservedAt || pending.last_observed_at || 0,
  ).getTime();
  return Number.isFinite(observedAt) && now - observedAt >= 45_000;
});

export const toClientScore = (snapshot: any, freshness?: string) => snapshot ? ({
  leftScore: snapshot.side_score,
  topScore: snapshot.top_score,
  quarterScores: snapshot.quarter_scores,
  clock: snapshot.clock || '',
  period: snapshot.period,
  state: snapshot.game_state,
  detail: snapshot.detail || '',
  isOvertime: snapshot.period > 4,
  isManual: snapshot.source_mode === 'manual',
  sourceName: snapshot.source_name || (snapshot.source_mode === 'manual' ? 'Organizer' : 'Automatic beta'),
  sourceUrl: snapshot.source_url || undefined,
  sourceObservedAt: snapshot.source_observed_at,
  retrievedAt: snapshot.retrieved_at,
  staleAfter: snapshot.stale_after,
  freshness: freshness || (new Date(snapshot.stale_after).getTime() > Date.now() ? 'fresh' : 'stale'),
}) : null;

const publicResponseEtag = (body: Record<string, any>) => {
  const parts = [
    String(body?.score?.retrievedAt || 'none'),
    String(body?.score?.freshness || ''),
    Array.isArray(body?.winnerHistory) ? body.winnerHistory.length : 0,
    Array.isArray(body?.pendingMilestones) ? body.pendingMilestones.length : 0,
  ];
  return `W/"${parts.join(':')}"`;
};

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env, params } = context;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server configuration is incomplete.' }, 503);
  const ref = String(params.id || '').toUpperCase();
  if (!uuidPattern.test(ref) && !sharePattern.test(ref)) return publicBoardNotFoundResponse();
  const isPublicRef = !uuidPattern.test(ref);
  const nextPollSeconds = scorePollSeconds(env);
  const refreshAllowed = liveScoringEnabled(env);

  // The anonymous share-code path is edge-cached: Pages Functions do not cache
  // on Cache-Control alone, so N viewers collapse into ~2 origin hits per
  // minute per board only if we consult the Cache API explicitly.
  const edgeCache = isPublicRef && typeof (globalThis as any).caches?.default?.match === 'function'
    ? (globalThis as any).caches.default
    : null;
  if (edgeCache) {
    const cached = await edgeCache.match(request.url).catch(() => null);
    if (cached) return cached;
  }

  /** Success responder: attaches nextPollSeconds and, on the public path,
   * shared-cache headers + ETag, then populates the edge cache. */
  const respond = (body: Record<string, unknown>, status = 200) => {
    const withPoll = status === 200 ? { ...body, nextPollSeconds } : body;
    if (!isPublicRef || status !== 200) return json(withPoll, status);
    const etag = publicResponseEtag(withPoll);
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': PUBLIC_CACHE_CONTROL,
      ETag: etag,
    };
    if (request.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers });
    }
    const response = new Response(JSON.stringify(withPoll), { status: 200, headers });
    if (edgeCache && typeof context.waitUntil === 'function') {
      context.waitUntil(edgeCache.put(request.url, response.clone()).catch(() => undefined));
    }
    return response;
  };

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ownerId: string | null = null;
  if (!isPublicRef) {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in before refreshing an organizer board.' }, 401);
    const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await auth.auth.getUser(token);
    ownerId = data.user?.id || null;
    if (!ownerId) return json({ error: 'Your session has expired.' }, 401);
  }
  let contest: any = null;
  if (!isPublicRef) {
    let contestQuery = admin
      .from('contests')
      .select('id, owner_id, status, game_external_id, game_starts_at, side_team_name, side_team_abbr, top_team_name, top_team_abbr, board_activations(id)');
    if (ownerId) contestQuery = contestQuery.eq('owner_id', ownerId);
    const { data, error } = await contestQuery.eq('id', ref).maybeSingle();
    if (error) {
      console.error('Score contest lookup failed:', error);
      return json({ error: 'Unable to load the board.' }, 500);
    }
    contest = data;
  } else {
    try {
      const visibleBoard = await findVisiblePublicBoard(admin, ref, {
        snapshot: 'contest_id',
        contest: 'id, owner_id, status, game_external_id, game_starts_at, side_team_name, side_team_abbr, top_team_name, top_team_abbr, board_activations(id)',
      });
      contest = visibleBoard?.contest || null;
    } catch (error: any) {
      console.error('Public board lookup failed:', error);
      return json({ error: 'Unable to load the board.' }, 500);
    }
  }
  if (!contest) {
    return !isPublicRef
      ? json({ error: 'Board not found or not published.' }, 404)
      : publicBoardNotFoundResponse();
  }
  if (!hasActivatedBoardServices(contest)) {
    return json({ error: 'Publish this board to use automatic live scoring and updates.' }, 402);
  }

  const { data: state } = await admin
    .from('contest_score_state')
    .select('scoring_mode, current_snapshot_id')
    .eq('contest_id', contest.id)
    .maybeSingle();
  const { data: current } = state?.current_snapshot_id
    ? await admin.from('score_snapshots').select('*').eq('id', state.current_snapshot_id).maybeSingle()
    : { data: null };
  let milestoneProjection = await readMilestoneProjection(admin, contest.id);

  if (state?.scoring_mode === 'manual' && !current) {
    return respond({
      score: null,
      ...milestoneProjection,
      scoringMode: 'manual',
      scoreState: 'awaiting_organizer_entry',
      message: 'Manual scoring is on. Waiting for the organizer to enter a score.',
      refreshAttempted: false,
    });
  }

  // Public viewers tolerate a grace window past stale_after before triggering
  // an inline ESPN refresh — the cron owns routine freshness, and the grace
  // keeps anonymous polls from becoming an upstream/DB amplifier.
  const graceMs = isPublicRef ? PUBLIC_REFRESH_GRACE_MS : 0;
  const isFreshEnough = Boolean(current)
    && new Date(current.stale_after).getTime() + graceMs > Date.now();
  const pendingConfirmationDue = Boolean(current)
    && pendingMilestoneConfirmationDue(milestoneProjection.pendingMilestones, Date.now() - graceMs);
  if (
    current
    && (isFreshEnough || current.game_state === 'post' || state?.scoring_mode === 'manual' || !refreshAllowed)
    && !(pendingConfirmationDue && refreshAllowed)
  ) {
    return respond({
      score: toClientScore(current),
      ...milestoneProjection,
      refreshAttempted: false,
    });
  }
  if (!refreshAllowed) {
    return json({ error: 'Automatic score is unavailable.' }, 503);
  }

  const leaseToken = crypto.randomUUID();
  const { data: acquiredRows, error: leaseError } = await admin.rpc('gridone_acquire_score_refresh_lease_v2', {
    p_contest_id: contest.id,
    p_lease_token: leaseToken,
    p_seconds: 45,
  });
  const lease = Array.isArray(acquiredRows) ? acquiredRows[0] : acquiredRows;
  if (leaseError) {
    console.error('Score refresh lease failed:', leaseError);
    return json({
      error: 'Live scoring is temporarily unavailable.',
      score: toClientScore(current, 'offline'),
    }, current ? 200 : 503);
  }
  if (!lease?.acquired) {
    if (lease?.scoring_mode === 'manual') {
      return respond({
        score: null,
        ...milestoneProjection,
        scoringMode: 'manual',
        scoreState: 'awaiting_organizer_entry',
        message: 'Manual scoring is on. Waiting for the organizer to enter a score.',
        refreshAttempted: false,
      });
    }
    return respond({
      score: toClientScore(current, 'refreshing'),
      ...milestoneProjection,
      refreshAttempted: false,
    });
  }

  try {
    const provider = await fetchExactEventScore(contest);
    const { promoted, inserted } = await applyProviderScore(admin, contest, lease, provider, current);
    let effective = promoted ? inserted : current;
    if (promoted) {
      milestoneProjection = await readMilestoneProjection(admin, contest.id);
    } else {
      const { data: latestState } = await admin
        .from('contest_score_state')
        .select('scoring_mode, current_snapshot_id')
        .eq('contest_id', contest.id)
        .maybeSingle();
      const { data: latestSnapshot } = latestState?.current_snapshot_id
        ? await admin
          .from('score_snapshots')
          .select('*')
          .eq('id', latestState.current_snapshot_id)
          .maybeSingle()
        : { data: null };
      effective = latestSnapshot;
      milestoneProjection = await readMilestoneProjection(admin, contest.id);
      if (latestState?.scoring_mode === 'manual' && !latestSnapshot) {
        return respond({
          score: null,
          ...milestoneProjection,
          scoringMode: 'manual',
          scoreState: 'awaiting_organizer_entry',
          message: 'Manual scoring is on. Waiting for the organizer to enter a score.',
          refreshAttempted: true,
        });
      }
    }
    return respond({
      score: toClientScore(effective),
      ...milestoneProjection,
      refreshAttempted: true,
    });
  } catch (error: any) {
    console.error('Score refresh failed:', error);
    const warning = isPublicRef
      ? 'Live score refresh is temporarily unavailable. Showing the last known score.'
      : error.message;
    if (current) return json({
      score: toClientScore(current, 'stale'),
      ...await readMilestoneProjection(admin, contest.id),
      refreshAttempted: true,
      warning,
      nextPollSeconds,
    });
    return json({
      error: isPublicRef
        ? 'Automatic score is unavailable.'
        : (error?.message || 'Automatic score is unavailable.'),
    }, 503);
  } finally {
    await admin.rpc('gridone_release_score_refresh_lease', {
      p_contest_id: contest.id,
      p_lease_token: leaseToken,
    });
  }
};
