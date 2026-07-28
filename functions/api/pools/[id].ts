import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

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
        .select('id, share_code, owner_id, title, status, revision, settings, board_data, published_at, board_activations(id)')
        .eq('id', id)
        .eq('owner_id', auth.userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(request, { error: 'Board not found.' }, 404, env.PUBLIC_SITE_URL);
      const { data: publicSnapshot } = await admin
        .from('public_board_snapshots')
        .select('winner_history')
        .eq('contest_id', data.id)
        .maybeSingle();
      return json(request, {
        id: data.id,
        share_code: data.share_code,
        owner_id: data.owner_id,
        title: data.title,
        status: data.status,
        revision: data.revision,
        ...(data.settings || {}),
        board: data.board_data,
        is_activated: Array.isArray(data.board_activations) && data.board_activations.length > 0,
        locked: Boolean(data.published_at),
        published_at: data.published_at,
        winner_history: publicSnapshot?.winner_history || [],
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
      dates: matchup.gameDate,
      board: data.board,
      score: data.score,
      winner_history: data.winner_history,
      payout_labels: data.payout_labels,
      is_activated: true,
      locked: true,
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
      .select('published_at, board_data')
      .eq('id', id)
      .eq('owner_id', auth.userId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!currentContest) return json(request, { error: 'Board not found.' }, 404, env.PUBLIC_SITE_URL);
    if (
      currentContest.published_at
      && body.board
      && JSON.stringify(body.board) !== JSON.stringify(currentContest.board_data)
    ) {
      return json(request, {
        error: 'Published assignments and number axes are locked.',
        code: 'BOARD_LOCKED',
      }, 409, env.PUBLIC_SITE_URL);
    }
    const updates: Record<string, unknown> = {};
    if (body.game) updates.settings = body.game;
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
      }, 409, env.PUBLIC_SITE_URL);
    }
    return json(request, { ok: true, revision: data.revision, updatedAt: data.updated_at }, 200, env.PUBLIC_SITE_URL);
  } catch (error: any) {
    return json(request, { error: error?.message || 'Unable to save the board.' }, 500, env.PUBLIC_SITE_URL);
  }
};
