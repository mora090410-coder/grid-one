import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

interface Env {
  PUBLIC_SITE_URL?: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
}

interface CreateBoardPayload {
  game: {
    title: string;
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

const validate = (input: unknown): CreateBoardPayload => {
  if (!input || typeof input !== 'object') throw new Error('Invalid request body.');
  const candidate = input as Partial<CreateBoardPayload>;
  const title = candidate.game?.title?.trim();
  if (!title || title.length > 100) throw new Error('Board name must be between 1 and 100 characters.');
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

    const game = { ...payload.game, title: payload.game.title.trim() };
    const date = typeof game.dates === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(game.dates)
      ? `${game.dates}T12:00:00Z`
      : null;
    const sideAxis = Array.isArray(payload.board.bearsAxis) && payload.board.bearsAxis.every(Number.isInteger)
      ? payload.board.bearsAxis
      : null;
    const topAxis = Array.isArray(payload.board.oppAxis) && payload.board.oppAxis.every(Number.isInteger)
      ? payload.board.oppAxis
      : null;

    const { data, error } = await supabase
      .from('contests')
      .insert({
        owner_id: authData.user.id,
        title: game.title,
        game_starts_at: date,
        side_team_abbr: game.leftAbbr || null,
        side_team_name: game.leftName || null,
        top_team_abbr: game.topAbbr || null,
        top_team_name: game.topName || null,
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
    const validationError = /board name|100 squares|invalid request/i.test(message);
    return json(request, { error: message }, validationError ? 400 : 500, env.PUBLIC_SITE_URL);
  }
};
