import { createClient } from '@supabase/supabase-js';
import {
  fetchScheduledGameById,
  type ScheduledGame,
} from '../../_lib/espnNfl';

type PagesFunction = (context: any) => Promise<Response> | Response;
const LAUNCH_SEASON_YEAR = 2026;

interface Env {
  PUBLIC_SITE_URL?: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sharePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

const responseHeaders = (request: Request, siteOrigin?: string) => {
  const origin = request.headers.get('Origin') || '';
  const allowed = new Set([
    'http://localhost:8788',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:49575',
    'https://getgridone.com',
    'https://www.getgridone.com',
    ...(siteOrigin ? [new URL(siteOrigin).origin] : []),
  ]);
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://www.getgridone.com',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
};

const json = (request: Request, body: unknown, status: number, siteOrigin?: string) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders(request, siteOrigin) });

const legacyDateFromKickoff = (kickoffAt: string) => kickoffAt.slice(0, 10);

export const canonicalizeUpdatedGame = (
  submitted: Record<string, unknown>,
  scheduled: ScheduledGame,
) => ({
  ...submitted,
  gameExternalId: scheduled.id,
  gameStartsAt: scheduled.kickoffAt,
  kickoffAt: scheduled.kickoffAt,
  gameSeason: scheduled.season,
  gameWeek: scheduled.week,
  dates: legacyDateFromKickoff(scheduled.kickoffAt),
  leftAbbr: scheduled.awayTeam.abbr,
  leftName: scheduled.awayTeam.name,
  topAbbr: scheduled.homeTeam.abbr,
  topName: scheduled.homeTeam.name,
});

interface StoredMatchup {
  game_external_id?: string | null;
  game_starts_at?: string | null;
  season_year?: number | null;
  side_team_name?: string | null;
  side_team_abbr?: string | null;
  top_team_name?: string | null;
  top_team_abbr?: string | null;
  settings?: { gameSeason?: unknown; gameWeek?: unknown } | null;
}

const sameInstant = (left?: string | null, right?: string | null) => {
  if (!left || !right) return left === right;
  return new Date(left).getTime() === new Date(right).getTime();
};

export const matchupDiffers = (stored: StoredMatchup, scheduled: ScheduledGame) =>
  stored.game_external_id !== scheduled.id
  || !sameInstant(stored.game_starts_at, scheduled.kickoffAt)
  || stored.season_year !== LAUNCH_SEASON_YEAR
  || stored.side_team_name !== scheduled.awayTeam.name
  || stored.side_team_abbr !== scheduled.awayTeam.abbr
  || stored.top_team_name !== scheduled.homeTeam.name
  || stored.top_team_abbr !== scheduled.homeTeam.abbr;

const storedScheduledGame = (
  stored: StoredMatchup,
  requestedExternalId: string,
): ScheduledGame | null => {
  if (
    stored.game_external_id !== requestedExternalId
    || !stored.game_starts_at
    || !stored.season_year
    || !stored.side_team_name
    || !stored.side_team_abbr
    || !stored.top_team_name
    || !stored.top_team_abbr
  ) {
    return null;
  }
  return {
    id: stored.game_external_id,
    kickoffAt: stored.game_starts_at,
    state: 'pre',
    season: Number.isInteger(stored.settings?.gameSeason)
      ? Number(stored.settings?.gameSeason)
      : LAUNCH_SEASON_YEAR,
    week: (
      typeof stored.settings?.gameWeek === 'number'
      || (
        typeof stored.settings?.gameWeek === 'string'
        && stored.settings.gameWeek.trim() !== ''
      )
    )
      ? stored.settings.gameWeek
      : '',
    awayTeam: {
      name: stored.side_team_name,
      abbr: stored.side_team_abbr,
    },
    homeTeam: {
      name: stored.top_team_name,
      abbr: stored.top_team_abbr,
    },
  };
};

const requireServiceClient = (env: Env) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Server configuration is incomplete.');
  return createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const requester = async (request: Request, env: Env) => {
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer) return { bearer: null, userId: null };
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.auth.getUser(bearer);
  return { bearer, userId: data.user?.id || null };
};

export const onRequestOptions: PagesFunction = ({ request, env }) =>
  new Response(null, { status: 204, headers: responseHeaders(request, env.PUBLIC_SITE_URL) });

export const onRequestGet: PagesFunction = async ({ request, env, params }) => {
  const id = String(params.id || '').toUpperCase();
  try {
    const admin = requireServiceClient(env);
    const auth = await requester(request, env);

    if (uuidPattern.test(id) && auth.userId) {
      const { data, error } = await admin
        .from('contests')
        .select('id, share_code, owner_id, title, status, revision, settings, board_data, payout_labels, published_at, game_external_id, game_starts_at, side_team_name, side_team_abbr, top_team_name, top_team_abbr, board_activations(id)')
        .eq('id', id)
        .eq('owner_id', auth.userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(request, { error: 'Board not found.' }, 404, env.PUBLIC_SITE_URL);
      const [
        { data: publicSnapshot, error: publicSnapshotError },
        { data: scoreState, error: scoreStateError },
      ] = await Promise.all([
        admin
          .from('public_board_snapshots')
          .select('winner_history, score')
          .eq('contest_id', data.id)
          .maybeSingle(),
        admin
          .from('contest_score_state')
          .select('scoring_mode, current_snapshot_id')
          .eq('contest_id', data.id)
          .maybeSingle(),
      ]);
      if (publicSnapshotError) throw publicSnapshotError;
      if (scoreStateError) throw scoreStateError;
      let currentScore = publicSnapshot?.score || null;
      if (scoreState?.current_snapshot_id) {
        const { data: snapshot, error: snapshotError } = await admin
          .from('score_snapshots')
          .select('source_mode, game_state, period, side_score, top_score, quarter_scores, clock, detail, source_name, source_observed_at, retrieved_at, stale_after')
          .eq('id', scoreState.current_snapshot_id)
          .eq('contest_id', data.id)
          .maybeSingle();
        if (snapshotError) throw snapshotError;
        if (snapshot) {
          currentScore = {
            leftScore: snapshot.side_score,
            topScore: snapshot.top_score,
            quarterScores: snapshot.quarter_scores,
            clock: snapshot.clock || '',
            period: snapshot.period,
            state: snapshot.game_state,
            detail: snapshot.detail || '',
            isOvertime: snapshot.period > 4,
            isManual: snapshot.source_mode === 'manual',
            sourceName: snapshot.source_name,
            sourceObservedAt: snapshot.source_observed_at,
            retrievedAt: snapshot.retrieved_at,
            staleAfter: snapshot.stale_after,
            freshness: 'fresh',
          };
        }
      }
      const useManualScores = scoreState?.scoring_mode === 'manual';
      return json(request, {
        id: data.id,
        share_code: data.share_code,
        owner_id: data.owner_id,
        title: data.title,
        status: data.status,
        revision: data.revision,
        ...(data.settings || {}),
        payouts: data.payout_labels || data.settings?.payouts || {},
        gameExternalId: data.game_external_id || data.settings?.gameExternalId || null,
        gameStartsAt: data.game_starts_at || data.settings?.gameStartsAt || null,
        kickoffAt: data.game_starts_at || data.settings?.kickoffAt || null,
        dates: data.game_starts_at
          ? legacyDateFromKickoff(data.game_starts_at)
          : data.settings?.dates || null,
        leftAbbr: data.side_team_abbr || data.settings?.leftAbbr || null,
        leftName: data.side_team_name || data.settings?.leftName || null,
        topAbbr: data.top_team_abbr || data.settings?.topAbbr || null,
        topName: data.top_team_name || data.settings?.topName || null,
        board: data.board_data,
        is_activated: Array.isArray(data.board_activations) && data.board_activations.length > 0,
        locked: Boolean(data.published_at),
        published_at: data.published_at,
        winner_history: publicSnapshot?.winner_history || [],
        score: currentScore,
        scoreSnapshot: currentScore,
        useManualScores,
        manualQuarterScores: useManualScores ? currentScore?.quarterScores : undefined,
        manualLeftScore: useManualScores ? currentScore?.leftScore : undefined,
        manualTopScore: useManualScores ? currentScore?.topScore : undefined,
        manualPeriod: useManualScores ? currentScore?.period : undefined,
        manualGameState: useManualScores ? currentScore?.state : undefined,
      }, 200, env.PUBLIC_SITE_URL);
    }

    if (!sharePattern.test(id)) {
      return json(request, { error: 'This board link is invalid.' }, 404, env.PUBLIC_SITE_URL);
    }

    const { data, error } = await admin
      .from('public_board_snapshots')
      .select('share_code, revision, board_title, matchup, board, score, winner_history, payout_labels, published_at, updated_at')
      .eq('share_code', id)
      .is('withdrawn_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return json(request, { error: 'This board is unavailable or has not been published.' }, 404, env.PUBLIC_SITE_URL);

    const matchup = data.matchup || {};
    return json(request, {
      share_code: data.share_code,
      title: data.board_title,
      revision: data.revision,
      published_at: data.published_at,
      updated_at: data.updated_at,
      leftAbbr: matchup.sideTeamAbbr,
      leftName: matchup.sideTeamName,
      topAbbr: matchup.topTeamAbbr,
      topName: matchup.topTeamName,
      gameExternalId: matchup.gameExternalId || null,
      gameStartsAt: matchup.gameStartsAt || matchup.gameDate || null,
      kickoffAt: matchup.gameStartsAt || matchup.gameDate || null,
      dates: matchup.gameStartsAt
        ? legacyDateFromKickoff(matchup.gameStartsAt)
        : matchup.gameDate,
      board: data.board,
      score: data.score,
      winner_history: data.winner_history,
      payout_labels: data.payout_labels,
      payouts: data.payout_labels,
      is_activated: true,
      locked: false,
    }, 200, env.PUBLIC_SITE_URL);
  } catch (error: any) {
    const message = error?.message || 'Unable to load the board.';
    return json(request, { error: message }, /configuration/i.test(message) ? 503 : 500, env.PUBLIC_SITE_URL);
  }
};

export const onRequestPut: PagesFunction = async ({ request, env, params }) => {
  const id = String(params.id || '');
  if (!uuidPattern.test(id)) return json(request, { error: 'Invalid board ID.' }, 400, env.PUBLIC_SITE_URL);

  try {
    const auth = await requester(request, env);
    if (!auth.bearer || !auth.userId) {
      return json(request, { error: 'Sign in to edit this board.' }, 401, env.PUBLIC_SITE_URL);
    }
    const body = await request.json() as { game?: Record<string, unknown>; board?: Record<string, unknown>; revision?: number };
    if (!body.game && !body.board) return json(request, { error: 'No board changes were provided.' }, 400, env.PUBLIC_SITE_URL);
    if (!Number.isInteger(body.revision) || Number(body.revision) < 1) {
      return json(request, { error: 'A current board revision is required.' }, 409, env.PUBLIC_SITE_URL);
    }

    const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${auth.bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: currentContest, error: currentError } = await client
      .from('contests')
      .select('published_at, status, revision, title, payout_labels, board_data, settings, game_external_id, game_starts_at, season_year, side_team_name, side_team_abbr, top_team_name, top_team_abbr')
      .eq('id', id)
      .eq('owner_id', auth.userId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!currentContest) return json(request, { error: 'Board not found.' }, 404, env.PUBLIC_SITE_URL);
    if (currentContest.published_at && body.board && JSON.stringify(body.board) !== JSON.stringify(currentContest.board_data)) {
      return json(request, {
        error: 'Published assignments and number axes are locked.',
        code: 'BOARD_LOCKED',
      }, 409, env.PUBLIC_SITE_URL);
    }

    if (body.game) {
      const gameExternalId = typeof body.game.gameExternalId === 'string'
        ? body.game.gameExternalId.trim()
        : '';
      if (!gameExternalId) {
        return json(request, {
          error: 'Choose a scheduled NFL game before saving.',
        }, 400, env.PUBLIC_SITE_URL);
      }
      const title = typeof body.game.title === 'string' ? body.game.title.trim() : '';
      if (!title || title.length > 100) {
        return json(request, {
          error: 'Board name must be between 1 and 100 characters.',
        }, 400, env.PUBLIC_SITE_URL);
      }
      const submittedPayouts = body.game.payouts;
      if (
        submittedPayouts !== undefined
        && (
          !submittedPayouts
          || typeof submittedPayouts !== 'object'
          || Array.isArray(submittedPayouts)
        )
      ) {
        return json(request, { error: 'Payout labels must be an object.' }, 400, env.PUBLIC_SITE_URL);
      }
      const payoutLabels = submittedPayouts || currentContest.payout_labels || {};

      let scheduledGame = storedScheduledGame(currentContest, gameExternalId);
      if (!scheduledGame) {
        try {
          scheduledGame = await fetchScheduledGameById(gameExternalId);
        } catch {
          return json(request, {
            error: 'The NFL schedule provider is unavailable. Retry in a moment.',
          }, 503, env.PUBLIC_SITE_URL);
        }
      }
      if (!scheduledGame) {
        return json(request, {
          error: 'That NFL game could not be verified. Choose a scheduled game and try again.',
        }, 400, env.PUBLIC_SITE_URL);
      }

      if (currentContest.published_at && matchupDiffers(currentContest, scheduledGame)) {
        return json(request, {
          error: 'The game on a published board cannot be changed.',
          code: 'MATCHUP_LOCKED',
        }, 409, env.PUBLIC_SITE_URL);
      }

      const settings = canonicalizeUpdatedGame({ ...body.game, title, payouts: payoutLabels }, scheduledGame);
      const admin = requireServiceClient(env);
      const { data: rpcData, error: rpcError } = await admin.rpc('gridone_update_draft_matchup', {
        p_contest_id: id,
        p_owner_id: auth.userId,
        p_expected_revision: body.revision,
        p_game_external_id: scheduledGame.id,
        p_game_starts_at: scheduledGame.kickoffAt,
        p_season_year: LAUNCH_SEASON_YEAR,
        p_side_team_name: scheduledGame.awayTeam.name,
        p_side_team_abbr: scheduledGame.awayTeam.abbr,
        p_top_team_name: scheduledGame.homeTeam.name,
        p_top_team_abbr: scheduledGame.homeTeam.abbr,
        p_title: title,
        p_payout_labels: payoutLabels,
        p_settings: settings,
        p_update_board: Boolean(body.board),
        p_board_data: body.board || null,
      });
      if (rpcError) {
        if (/published game identity is locked/i.test(rpcError.message || '')) {
          return json(request, {
            error: 'The game on a published board cannot be changed.',
            code: 'MATCHUP_LOCKED',
          }, 409, env.PUBLIC_SITE_URL);
        }
        throw rpcError;
      }
      const updated = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!updated) {
        return json(request, {
          error: 'This board changed in another session. Reload before saving again.',
          code: 'REVISION_CONFLICT',
          currentRevision: currentContest.revision,
        }, 409, env.PUBLIC_SITE_URL);
      }
      return json(request, {
        ok: true,
        revision: updated.next_revision,
        updatedAt: updated.contest_updated_at,
        matchupChanged: updated.matchup_changed,
      }, 200, env.PUBLIC_SITE_URL);
    }

    const updates: Record<string, unknown> = {};
    if (body.board) updates.board_data = body.board;

    const { data, error } = await client
      .from('contests')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', auth.userId)
      .eq('revision', body.revision)
      .select('id, revision, updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return json(request, {
        error: 'This board changed in another session. Reload before saving again.',
        code: 'REVISION_CONFLICT',
        currentRevision: currentContest.revision,
      }, 409, env.PUBLIC_SITE_URL);
    }
    return json(request, { ok: true, revision: data.revision, updatedAt: data.updated_at }, 200, env.PUBLIC_SITE_URL);
  } catch (error: any) {
    const message = error?.message || 'Unable to save the board.';
    return json(request, { error: message }, /configuration/i.test(message) ? 503 : 500, env.PUBLIC_SITE_URL);
  }
};
