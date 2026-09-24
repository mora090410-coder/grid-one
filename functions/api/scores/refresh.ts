/**
 * Cron-driven score refresh. A scheduled Worker POSTs here every minute; this
 * endpoint fetches ESPN's scoreboard ONCE for the entire live slate and
 * promotes a snapshot for every active board — so boards advance (milestones,
 * winner notifications) even with zero live viewers, and viewer polls become
 * pure cached snapshot reads.
 *
 * Off-day cost is one indexed Postgres query: when no boards are inside their
 * game window the handler exits before touching ESPN.
 */
import { fetchLiveScoreboard } from '../../_lib/espnNfl';
import { createScoreProviderRecovery } from '../../_lib/scoreProviderRecovery';
import {
  fetchExactEventScore,
  liveScoringEnabled,
  providerScoreFromEspnSnapshot,
  refreshContestScore,
  scorePollSeconds,
} from '../../_lib/scoreRefresh';
import { timingSafeEqual } from '../../_lib/crypto';
import { adminClient, runBounded, type PagesFunction } from '../../_lib/http';

// Refresh boards from shortly before kickoff until the game window is over.
const WINDOW_BEFORE_KICKOFF_MS = 30 * 60_000;
const WINDOW_AFTER_KICKOFF_MS = 12 * 60 * 60_000;
// Boards refresh a few at a time so a busy slate does not scale linearly,
// without flooding Postgres. Each board keeps its own lease and error.
const CONTEST_REFRESH_CONCURRENCY = 4;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const embeddedScoreState = (contest: any) => {
  const state = contest?.contest_score_state;
  return Array.isArray(state) ? state[0] : state;
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!env.CRON_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY || !env.VITE_SUPABASE_URL) {
    return json({ error: 'Score refresh scheduler is not configured.' }, 503);
  }
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!timingSafeEqual(bearer, env.CRON_SECRET)) {
    return json({ error: 'Unauthorized.' }, 401);
  }
  if (!liveScoringEnabled(env)) {
    return json({ disabled: true, active: 0, refreshed: 0 });
  }

  const admin = adminClient(env);

  // Honor SCORE_POLL_SECONDS even though the cron fires every minute: the slot
  // claim is atomic in Postgres, so overlapping ticks skip instead of racing.
  const pollSeconds = scorePollSeconds(env);
  const { data: claimed, error: claimError } = await admin.rpc('gridone_claim_scheduler_slot', {
    p_key: 'score_refresh',
    p_interval_seconds: pollSeconds,
  });
  if (claimError) return json({ error: 'Scheduler state is unavailable.' }, 503);
  if (!claimed) return json({ skipped: true, pollSeconds });

  const now = Date.now();
  const { data: contests, error: contestsError } = await admin
    .from('contests')
    .select('id, published_at, status, game_external_id, game_starts_at, side_team_abbr, top_team_abbr, board_activations!inner(id), contest_score_state(scoring_mode, milestones_finalized_at)')
    .not('game_external_id', 'is', null)
    .not('published_at', 'is', null)
    .in('status', ['published', 'live', 'final'])
    .gte('game_starts_at', new Date(now - WINDOW_AFTER_KICKOFF_MS).toISOString())
    .lte('game_starts_at', new Date(now + WINDOW_BEFORE_KICKOFF_MS).toISOString());
  if (contestsError) return json({ error: 'Unable to load active boards.' }, 503);

  const active = (contests || []).filter((contest: any) => {
    const state = embeddedScoreState(contest);
    return Boolean(contest.published_at) && ['published', 'live', 'final'].includes(contest.status)
      && state?.scoring_mode !== 'manual' && !state?.milestones_finalized_at;
  });
  if (active.length === 0) {
    return json({ active: 0, refreshed: 0, pollSeconds });
  }

  let scoreboard: Awaited<ReturnType<typeof fetchLiveScoreboard>> | null = null;
  let scoreboardError: string | null = null;
  try {
    scoreboard = await fetchLiveScoreboard();
  } catch (error: any) {
    // Fall back to per-event summaries below rather than failing the tick.
    scoreboardError = error?.message || 'ESPN scoreboard request failed.';
    console.error('Score refresh scoreboard fetch failed:', error);
  }

  let refreshed = 0;
  const recoverScore = createScoreProviderRecovery(env);
  const errors: Array<{ contestId: string; error: string }> = [];
  await runBounded(active, CONTEST_REFRESH_CONCURRENCY, async (contest: any) => {
    try {
      const entry = scoreboard?.games.get(String(contest.game_external_id));
      const provider = await recoverScore(contest, async () => {
        if (entry) return providerScoreFromEspnSnapshot(contest, entry.snapshot, entry.rawEvent);
        // A denied slate endpoint is already evidence of a provider outage.
        // Use the independent feed directly instead of repeating denied calls.
        if (env.API_SPORTS_KEY && scoreboardError?.includes('HTTP 403')) throw new Error(scoreboardError);
        return fetchExactEventScore(contest);
      });
      const outcome = await refreshContestScore(admin, contest, provider);
      if (outcome.status === 'refreshed') refreshed += 1;
      else if (outcome.status === 'error') errors.push({ contestId: contest.id, error: outcome.error });
    } catch (error: any) {
      errors.push({ contestId: contest.id, error: error?.message || 'Refresh failed.' });
    }
  });

  // Opportunistic storage hygiene; failures are logged, never fatal.
  const { error: pruneError } = await admin.rpc('gridone_prune_score_provider_payloads', {
    p_retain_days: 7,
    p_limit: 200,
  });
  if (pruneError) console.error('Score payload pruning failed:', pruneError);

  if (errors.length > 0) console.error('Score refresh errors:', JSON.stringify(errors));
  return json({
    active: active.length,
    refreshed,
    failed: errors.length,
    pollSeconds,
    ...(scoreboardError ? { scoreboardError } : {}),
  }, errors.length > 0 && refreshed === 0 ? 503 : 200);
};
