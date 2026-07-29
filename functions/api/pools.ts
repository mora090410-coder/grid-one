import { createClient } from '@supabase/supabase-js';
import {
  fetchScheduledGameById,
  fetchScheduledGames,
  type ScheduledGame,
} from '../_lib/espnNfl';
import { scoreTestModeAllowed } from '../_lib/scoreTestMode';

type PagesFunction = (context: any) => Promise<Response> | Response;
const LAUNCH_SEASON_YEAR = 2026;

interface CreateBoardPayload {
  scoreTestMode?: boolean;
  game: {
    title: string;
    gameExternalId: string;
    dates?: string;
    leftAbbr?: string;
    leftName?: string;
    topAbbr?: string;
    topName?: string;
    payouts?: Record<string, number | string>;
    [key: string]: unknown;
  };
  board: {
    squares: unknown[];
    bearsAxis?: Array<number | null>;
    oppAxis?: Array<number | null>;
    [key: string]: unknown;
  };
}

export { scoreTestModeAllowed };

const allowedOrigins = new Set([
  'http://localhost:8788',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:49575',
  'https://getgridone.com',
  'https://www.getgridone.com',
]);

const json = (request: Request, body: unknown, status: number, siteOrigin?: string) => {
  const requestOrigin = request.headers.get('Origin');
  const configuredOrigin = siteOrigin ? new URL(siteOrigin).origin : null;
  const origin = requestOrigin && (allowedOrigins.has(requestOrigin) || requestOrigin === configuredOrigin)
    ? requestOrigin
    : configuredOrigin || 'https://www.getgridone.com';
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary': 'Origin',
    },
  });
};

export const legacyDateFromKickoff = (kickoffAt: string) => kickoffAt.slice(0, 10);

export const canonicalizeGameSettings = (
  submitted: CreateBoardPayload['game'],
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

const validate = (input: unknown): CreateBoardPayload => {
  if (!input || typeof input !== 'object') throw new Error('Invalid request body.');
  const candidate = input as Partial<CreateBoardPayload>;
  const title = candidate.game?.title?.trim();
  if (!title || title.length > 100) throw new Error('Board name must be between 1 and 100 characters.');
  if (!candidate.game?.gameExternalId?.trim()) {
    throw new Error('Choose a scheduled NFL game before continuing.');
  }
  if (!candidate.board || !Array.isArray(candidate.board.squares) || candidate.board.squares.length !== 100) {
    throw new Error('A board must contain exactly 100 squares.');
  }
  return candidate as CreateBoardPayload;
};

export const onRequestOptions: PagesFunction = ({ request, env }) =>
  json(request, {}, 204, env.PUBLIC_SITE_URL);

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!bearer) return json(request, { error: 'Sign in before creating a board.' }, 401, env.PUBLIC_SITE_URL);

    const payload = validate(await request.json());
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
    if (authError || !authData.user) {
      return json(request, { error: 'Your session has expired. Sign in again.' }, 401, env.PUBLIC_SITE_URL);
    }
    const scoreTestGateOpen = payload.scoreTestMode === true
      && scoreTestModeAllowed(env, authData.user.id);

    let scheduledGame: ScheduledGame | null;
    try {
      scheduledGame = await fetchScheduledGameById(payload.game.gameExternalId);
    } catch {
      return json(request, {
        error: 'The NFL schedule provider is unavailable. Retry in a moment.',
      }, 503, env.PUBLIC_SITE_URL);
    }
    if (!scheduledGame) {
      return json(request, {
        error: 'That NFL game could not be verified. Choose a scheduled game and try again.',
      }, 400, env.PUBLIC_SITE_URL);
    }
    const scoreTestMode = scoreTestGateOpen && scheduledGame.state !== 'pre';
    if (scheduledGame.state !== 'pre') {
      if (!scoreTestMode) {
        return json(request, {
          error: 'Choose an upcoming NFL game.',
        }, 400, env.PUBLIC_SITE_URL);
      }
      let recentCompleted: ScheduledGame[];
      try {
        recentCompleted = await fetchScheduledGames({ scope: 'completed', limit: 5 });
      } catch {
        return json(request, {
          error: 'The completed-game test list is unavailable. Retry in a moment.',
        }, 503, env.PUBLIC_SITE_URL);
      }
      if (!recentCompleted.some((game) => game.id === scheduledGame.id)) {
        return json(request, {
          error: 'Score-test boards are limited to the five most recent completed NFL games.',
        }, 400, env.PUBLIC_SITE_URL);
      }
    }
    const game = canonicalizeGameSettings({
      ...payload.game,
      title: payload.game.title.trim(),
    }, scheduledGame);
    const sideAxis = Array.isArray(payload.board.bearsAxis) && payload.board.bearsAxis.every(Number.isInteger)
      ? payload.board.bearsAxis
      : null;
    const topAxis = Array.isArray(payload.board.oppAxis) && payload.board.oppAxis.every(Number.isInteger)
      ? payload.board.oppAxis
      : null;
    if (scoreTestMode && !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json(request, { error: 'Server configuration is incomplete.' }, 503, env.PUBLIC_SITE_URL);
    }
    const writeClient = scoreTestMode
      ? createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      : supabase;

    const { data, error } = await writeClient
      .from('contests')
      .insert({
        owner_id: authData.user.id,
        score_test_mode: scoreTestMode,
        title: game.title,
        season_year: LAUNCH_SEASON_YEAR,
        game_external_id: scheduledGame.id,
        game_starts_at: scheduledGame.kickoffAt,
        side_team_abbr: scheduledGame.awayTeam.abbr,
        side_team_name: scheduledGame.awayTeam.name,
        top_team_abbr: scheduledGame.homeTeam.abbr,
        top_team_name: scheduledGame.homeTeam.name,
        side_axis: sideAxis,
        top_axis: topAxis,
        payout_labels: game.payouts || {},
        settings: game,
        board_data: payload.board,
      })
      .select('id, share_code, revision')
      .single();

    if (error) throw error;
    return json(request, {
      success: true,
      boardId: data.id,
      shareCode: data.share_code,
      revision: data.revision,
      poolId: data.id,
    }, 201, env.PUBLIC_SITE_URL);
  } catch (error: any) {
    const message = error?.message || 'Unable to create the board.';
    const validationError = /board name|100 squares|invalid request|scheduled NFL game/i.test(message);
    return json(request, { error: message }, validationError ? 400 : 500, env.PUBLIC_SITE_URL);
  }
};
