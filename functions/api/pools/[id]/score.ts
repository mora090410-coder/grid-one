import { createClient } from '@supabase/supabase-js';
import {
  fetchEspnSummary,
  normalizeEspnScoreSummary,
  normalizeTeamAbbreviation,
} from '../../../_lib/espnNfl';
import {
  findVisiblePublicBoard,
  publicBoardNotFoundResponse,
} from '../../../_lib/publicBoardVisibility';

type PagesFunction = (context: any) => Promise<Response> | Response;

type QuarterScore = { left: number; top: number };
type ProviderScore = {
  leftScore: number;
  topScore: number;
  quarterScores: Record<'Q1' | 'Q2' | 'Q3' | 'Q4' | 'OT', QuarterScore>;
  clock: string;
  period: number;
  state: 'pre' | 'in' | 'post';
  detail: string;
  isOvertime: boolean;
  sourceObservedAt: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sharePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export const hasActivatedBoardServices = (contest: { board_activations?: unknown } | null | undefined) =>
  Array.isArray(contest?.board_activations) && contest.board_activations.length > 0;

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

const isIntegerScore = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255;

export const validateScore = (candidate: any): ProviderScore => {
  if (!candidate || !isIntegerScore(candidate.leftScore) || !isIntegerScore(candidate.topScore)) {
    throw new Error('Provider returned invalid score totals.');
  }
  if (!['pre', 'in', 'post'].includes(candidate.state) || !Number.isInteger(candidate.period) || candidate.period < 0 || candidate.period > 5) {
    throw new Error('Provider returned an invalid game state.');
  }
  const keys = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const;
  for (const key of keys) {
    if (!candidate.quarterScores?.[key] || !isIntegerScore(candidate.quarterScores[key].left) || !isIntegerScore(candidate.quarterScores[key].top)) {
      throw new Error(`Provider returned invalid ${key} scoring.`);
    }
  }
  const leftTotal = keys.reduce((sum, key) => sum + candidate.quarterScores[key].left, 0);
  const topTotal = keys.reduce((sum, key) => sum + candidate.quarterScores[key].top, 0);
  if (candidate.state !== 'pre' && (leftTotal !== candidate.leftScore || topTotal !== candidate.topScore)) {
    throw new Error('Quarter scoring does not match the reported total.');
  }
  const observed = new Date(candidate.sourceObservedAt);
  if (Number.isNaN(observed.getTime())) throw new Error('Provider did not report when the source score was observed.');
  return {
    leftScore: candidate.leftScore,
    topScore: candidate.topScore,
    quarterScores: candidate.quarterScores,
    clock: String(candidate.clock || '').slice(0, 32),
    period: candidate.period,
    state: candidate.state,
    detail: String(candidate.detail || '').slice(0, 160),
    isOvertime: Boolean(candidate.isOvertime),
    sourceObservedAt: observed.toISOString(),
  };
};

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

export const fetchExactEventScore = async (contest: any, fetchImpl: typeof fetch = fetch) => {
  const eventId = String(contest.game_external_id || '').trim();
  if (!/^\d+$/.test(eventId)) {
    throw new Error('Automatic scoring requires a linked scheduled NFL game. Use manual scoring for this legacy board.');
  }
  const raw = await fetchEspnSummary(eventId, fetchImpl);
  if (!raw) throw new Error('The linked NFL game was not found.');
  const provider = normalizeEspnScoreSummary(raw);
  const expectedSide = normalizeTeamAbbreviation(contest.side_team_abbr);
  const expectedTop = normalizeTeamAbbreviation(contest.top_team_abbr);
  const expectedKickoff = new Date(contest.game_starts_at).getTime();
  const providerKickoff = new Date(provider.kickoffAt).getTime();
  if (
    provider.eventId !== eventId
    || provider.awayTeam.abbr !== expectedSide
    || provider.homeTeam.abbr !== expectedTop
    || Number.isNaN(expectedKickoff)
    || providerKickoff !== expectedKickoff
  ) {
    throw new Error('The score provider returned a different NFL game than the board is linked to.');
  }
  const observedAt = new Date().toISOString();
  const score = validateScore({
    leftScore: provider.awayTeam.score,
    topScore: provider.homeTeam.score,
    quarterScores: {
      Q1: { left: provider.awayTeam.quarterScores.Q1, top: provider.homeTeam.quarterScores.Q1 },
      Q2: { left: provider.awayTeam.quarterScores.Q2, top: provider.homeTeam.quarterScores.Q2 },
      Q3: { left: provider.awayTeam.quarterScores.Q3, top: provider.homeTeam.quarterScores.Q3 },
      Q4: { left: provider.awayTeam.quarterScores.Q4, top: provider.homeTeam.quarterScores.Q4 },
      OT: { left: provider.awayTeam.quarterScores.OT, top: provider.homeTeam.quarterScores.OT },
    },
    clock: provider.clock,
    // GridOne models every period after Q4 as the single OT milestone.
    period: Math.min(provider.period, 5),
    state: provider.state,
    detail: provider.detail,
    isOvertime: provider.period > 4,
    sourceObservedAt: observedAt,
  });
  return {
    score,
    source: {
      title: 'ESPN',
      uri: `https://www.espn.com/nfl/game/_/gameId/${encodeURIComponent(eventId)}`,
    },
    raw,
  };
};

export const scoreStaleAfter = (
  scoreState: ProviderScore['state'],
  retrievedAt: Date,
  kickoffAt?: string | null,
) => {
  const staleSeconds = scoreState === 'in' ? 120 : scoreState === 'post' ? 31_536_000 : 900;
  const defaultStaleAt = retrievedAt.getTime() + staleSeconds * 1000;
  if (scoreState !== 'pre' || !kickoffAt) return new Date(defaultStaleAt).toISOString();
  const kickoffTime = new Date(kickoffAt).getTime();
  if (Number.isNaN(kickoffTime)) return new Date(defaultStaleAt).toISOString();
  // A pre-game snapshot must become stale no later than kickoff. Equality with
  // retrieved_at is valid and forces the next request to recheck immediately.
  return new Date(Math.max(retrievedAt.getTime(), Math.min(defaultStaleAt, kickoffTime))).toISOString();
};

export const onRequestGet: PagesFunction = async ({ request, env, params }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server configuration is incomplete.' }, 503);
  const ref = String(params.id || '').toUpperCase();
  if (!uuidPattern.test(ref) && !sharePattern.test(ref)) return publicBoardNotFoundResponse();
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ownerId: string | null = null;
  if (uuidPattern.test(ref)) {
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
  if (uuidPattern.test(ref)) {
    let contestQuery = admin
      .from('contests')
      .select('id, owner_id, status, game_external_id, game_starts_at, side_team_name, side_team_abbr, top_team_name, top_team_abbr, board_activations(id)');
    if (ownerId) contestQuery = contestQuery.eq('owner_id', ownerId);
    const { data, error } = await contestQuery.eq('id', ref).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    contest = data;
  } else {
    try {
      const visibleBoard = await findVisiblePublicBoard(admin, ref, {
        snapshot: 'contest_id',
        contest: 'id, owner_id, status, game_external_id, game_starts_at, side_team_name, side_team_abbr, top_team_name, top_team_abbr, board_activations(id)',
      });
      contest = visibleBoard?.contest || null;
    } catch (error: any) {
      return json({ error: error?.message || 'Unable to load the board.' }, 500);
    }
  }
  if (!contest) {
    return uuidPattern.test(ref)
      ? json({ error: 'Board not found or not published.' }, 404)
      : publicBoardNotFoundResponse();
  }
  if (!hasActivatedBoardServices(contest)) {
    return json({ error: 'Unlock this board to use automatic live scoring and updates.' }, 402);
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
    return json({
      score: null,
      ...milestoneProjection,
      scoringMode: 'manual',
      scoreState: 'awaiting_organizer_entry',
      message: 'Manual scoring is on. Waiting for the organizer to enter a score.',
      refreshAttempted: false,
    });
  }

  const isFresh = current && new Date(current.stale_after).getTime() > Date.now();
  const pendingConfirmationDue = Boolean(current)
    && pendingMilestoneConfirmationDue(milestoneProjection.pendingMilestones);
  if (
    current
    && (isFresh || current.game_state === 'post' || state?.scoring_mode === 'manual')
    && !pendingConfirmationDue
  ) {
    return json({
      score: toClientScore(current),
      ...milestoneProjection,
      refreshAttempted: false,
    });
  }

  const leaseToken = crypto.randomUUID();
  const { data: acquiredRows, error: leaseError } = await admin.rpc('gridone_acquire_score_refresh_lease_v2', {
    p_contest_id: contest.id,
    p_lease_token: leaseToken,
    p_seconds: 45,
  });
  const lease = Array.isArray(acquiredRows) ? acquiredRows[0] : acquiredRows;
  if (leaseError) return json({ error: leaseError.message, score: toClientScore(current, 'offline') }, current ? 200 : 503);
  if (!lease?.acquired) {
    if (lease?.scoring_mode === 'manual') {
      return json({
        score: null,
        ...milestoneProjection,
        scoringMode: 'manual',
        scoreState: 'awaiting_organizer_entry',
        message: 'Manual scoring is on. Waiting for the organizer to enter a score.',
        refreshAttempted: false,
      });
    }
    return json({
      score: toClientScore(current, 'refreshing'),
      ...milestoneProjection,
      refreshAttempted: false,
    });
  }

  try {
    const provider = await fetchExactEventScore(contest);
    const retrievedAt = new Date();
    const staleAfter = scoreStaleAfter(provider.score.state, retrievedAt, contest.game_starts_at);
    const { data: inserted, error: insertError } = await admin
      .from('score_snapshots')
      .insert({
        contest_id: contest.id,
        source_mode: 'automatic',
        provider: 'espn',
        game_state: provider.score.state,
        period: provider.score.period,
        side_score: provider.score.leftScore,
        top_score: provider.score.topScore,
        quarter_scores: provider.score.quarterScores,
        clock: provider.score.clock,
        detail: provider.score.detail,
        validation_status: 'accepted',
        source_name: provider.source.title,
        source_url: provider.source.uri,
        source_observed_at: provider.score.sourceObservedAt,
        retrieved_at: retrievedAt.toISOString(),
        stale_after: staleAfter,
        authority_generation: lease.authority_generation,
        refresh_sequence: lease.refresh_sequence,
        refresh_started_at: lease.refresh_started_at,
      })
      .select('*')
      .single();
    if (insertError) throw insertError;
    await admin.from('score_provider_payloads').insert({ snapshot_id: inserted.id, raw_payload: provider.raw });
    const { data: promoted, error: promoteError } = await admin.rpc('gridone_promote_score_snapshot', {
      p_contest_id: contest.id,
      p_snapshot_id: inserted.id,
    });
    if (promoteError) throw promoteError;
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
        return json({
          score: null,
          ...milestoneProjection,
          scoringMode: 'manual',
          scoreState: 'awaiting_organizer_entry',
          message: 'Manual scoring is on. Waiting for the organizer to enter a score.',
          refreshAttempted: true,
        });
      }
    }
    return json({
      score: toClientScore(effective),
      ...milestoneProjection,
      refreshAttempted: true,
    });
  } catch (error: any) {
    if (current) return json({
      score: toClientScore(current, 'stale'),
      ...await readMilestoneProjection(admin, contest.id),
      refreshAttempted: true,
      warning: error.message,
    });
    return json({ error: error?.message || 'Automatic score is unavailable.' }, 503);
  } finally {
    await admin.rpc('gridone_release_score_refresh_lease', {
      p_contest_id: contest.id,
      p_lease_token: leaseToken,
    });
  }
};
