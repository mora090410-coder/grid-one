/**
 * Shared score-refresh pipeline: provider validation, snapshot persistence,
 * and lease-guarded promotion. Used by both the viewer-facing score endpoint
 * (fallback path) and the cron-driven /api/scores/refresh endpoint.
 */
import {
  EspnScoreSnapshot,
  fetchEspnSummary,
  normalizeEspnScoreSummary,
  normalizeTeamAbbreviation,
} from './espnNfl';

type QuarterScore = { left: number; top: number };
export type ProviderScore = {
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

export type ProviderScoreResult = {
  score: ProviderScore;
  source: { title: string; uri: string };
  raw: unknown;
};

const isIntegerScore = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255;

export const scorePollSeconds = (env: any): number => {
  const raw = Number(env?.SCORE_POLL_SECONDS);
  if (!Number.isInteger(raw)) return 60;
  return Math.min(300, Math.max(30, raw));
};

export const liveScoringEnabled = (env: any): boolean => env?.LIVE_SCORING_ENABLED !== 'false';

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

/**
 * Validates a normalized ESPN snapshot against the board's linked game and
 * converts it into the board-oriented provider score. The identity guard
 * ensures a board can never be scored by the wrong game.
 */
export const providerScoreFromEspnSnapshot = (
  contest: any,
  provider: EspnScoreSnapshot,
  raw: unknown,
): ProviderScoreResult => {
  const eventId = String(contest.game_external_id || '').trim();
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

export const fetchExactEventScore = async (
  contest: any,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderScoreResult> => {
  const eventId = String(contest.game_external_id || '').trim();
  if (!/^\d+$/.test(eventId)) {
    throw new Error('Automatic scoring requires a linked scheduled NFL game. Use manual scoring for this legacy board.');
  }
  const raw = await fetchEspnSummary(eventId, fetchImpl);
  if (!raw) throw new Error('The linked NFL game was not found.');
  return providerScoreFromEspnSnapshot(contest, normalizeEspnScoreSummary(raw), raw);
};

const scoreMateriallyChanged = (previous: any, score: ProviderScore): boolean => {
  if (!previous) return true;
  return previous.side_score !== score.leftScore
    || previous.top_score !== score.topScore
    || previous.game_state !== score.state
    || previous.period !== score.period;
};

export interface ApplyProviderScoreResult {
  promoted: boolean;
  inserted: any;
}

/**
 * Inserts a snapshot under an already-acquired refresh lease and promotes it.
 * The raw provider payload is only archived when the score materially changed,
 * so storage grows with scoring events instead of with polling frequency.
 */
export const applyProviderScore = async (
  admin: any,
  contest: any,
  lease: any,
  provider: ProviderScoreResult,
  previousSnapshot: any,
): Promise<ApplyProviderScoreResult> => {
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
  if (scoreMateriallyChanged(previousSnapshot, provider.score)) {
    await admin.from('score_provider_payloads').insert({ snapshot_id: inserted.id, raw_payload: provider.raw });
  }
  const { data: promoted, error: promoteError } = await admin.rpc('gridone_promote_score_snapshot', {
    p_contest_id: contest.id,
    p_snapshot_id: inserted.id,
  });
  if (promoteError) throw promoteError;
  return { promoted: Boolean(promoted), inserted };
};

export type RefreshOutcome =
  | { status: 'refreshed'; promoted: boolean }
  | { status: 'lease_busy' }
  | { status: 'manual' }
  | { status: 'error'; error: string };

/**
 * Full lease-guarded refresh for one contest from an already-fetched provider
 * score. Used by the cron endpoint; the viewer endpoint keeps its own flow so
 * it can shape per-caller responses.
 */
export const refreshContestScore = async (
  admin: any,
  contest: any,
  provider: ProviderScoreResult,
): Promise<RefreshOutcome> => {
  const leaseToken = crypto.randomUUID();
  const { data: acquiredRows, error: leaseError } = await admin.rpc('gridone_acquire_score_refresh_lease_v2', {
    p_contest_id: contest.id,
    p_lease_token: leaseToken,
    p_seconds: 45,
  });
  if (leaseError) return { status: 'error', error: leaseError.message };
  const lease = Array.isArray(acquiredRows) ? acquiredRows[0] : acquiredRows;
  if (!lease?.acquired) {
    return lease?.scoring_mode === 'manual' ? { status: 'manual' } : { status: 'lease_busy' };
  }
  try {
    const { data: state } = await admin
      .from('contest_score_state')
      .select('current_snapshot_id')
      .eq('contest_id', contest.id)
      .maybeSingle();
    const { data: previous } = state?.current_snapshot_id
      ? await admin
        .from('score_snapshots')
        .select('side_score, top_score, game_state, period')
        .eq('id', state.current_snapshot_id)
        .maybeSingle()
      : { data: null };
    const { promoted } = await applyProviderScore(admin, contest, lease, provider, previous);
    return { status: 'refreshed', promoted };
  } catch (error: any) {
    return { status: 'error', error: error?.message || 'Score refresh failed.' };
  } finally {
    await admin.rpc('gridone_release_score_refresh_lease', {
      p_contest_id: contest.id,
      p_lease_token: leaseToken,
    });
  }
};
