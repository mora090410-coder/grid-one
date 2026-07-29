import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

const validAxis = (axis: unknown): axis is number[] =>
  Array.isArray(axis)
  && axis.length === 10
  && axis.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)
  && new Set(axis).size === 10;

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Publishing is not configured.' }, { status: 503 });
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Sign in before publishing.' }, { status: 401 });
  const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await auth.auth.getUser(token);
  if (!authData.user) return Response.json({ error: 'Your session has expired.' }, { status: 401 });

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: contest, error } = await admin
    .from('contests')
    .select('id, share_code, owner_id, title, revision, settings, board_data, published_at, side_axis, top_axis, side_team_name, side_team_abbr, top_team_name, top_team_abbr, game_external_id, game_starts_at, payout_labels, board_activations(id)')
    .eq('id', String(params.id || ''))
    .eq('owner_id', authData.user.id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!contest) return Response.json({ error: 'Board not found.' }, { status: 404 });
  if (!Array.isArray(contest.board_activations) || !contest.board_activations.length) {
    return Response.json({ error: 'Unlock this board with the 2026 season pass before publishing.' }, { status: 402 });
  }

  const board = contest.board_data || {};
  const sideAxis = validAxis(board.bearsAxis) ? board.bearsAxis : contest.side_axis;
  const topAxis = validAxis(board.oppAxis) ? board.oppAxis : contest.top_axis;
  if (!validAxis(sideAxis) || !validAxis(topAxis)) {
    return Response.json({ error: 'Draw all ten unique axis digits before publishing.' }, { status: 409 });
  }
  if (!Array.isArray(board.squares) || board.squares.length !== 100) {
    return Response.json({ error: 'The board must contain exactly 100 squares.' }, { status: 409 });
  }
  const normalizedNames = board.squares.map((cell: unknown) =>
    Array.isArray(cell) ? cell.filter((name) => typeof name === 'string' && name.trim()).map((name) => String(name).trim()) : [],
  );
  const unassigned = normalizedNames.filter((names: string[]) => !names.length).length;
  if (unassigned) {
    return Response.json({ error: `${unassigned} squares are still unassigned. Finish the board before publishing.` }, { status: 409 });
  }
  const multiplyAssigned = normalizedNames.filter((names: string[]) => names.length !== 1).length;
  if (multiplyAssigned) {
    return Response.json({ error: `${multiplyAssigned} squares have more than one name. Use one purchaser identity per square before publishing.` }, { status: 409 });
  }

  const publicBoard = {
    bearsAxis: sideAxis,
    oppAxis: topAxis,
    squares: normalizedNames,
    isDynamic: false,
  };
  const matchup = {
    sideTeamName: contest.side_team_name || contest.settings?.leftName,
    sideTeamAbbr: contest.side_team_abbr || contest.settings?.leftAbbr,
    topTeamName: contest.top_team_name || contest.settings?.topName,
    topTeamAbbr: contest.top_team_abbr || contest.settings?.topAbbr,
    gameExternalId: contest.game_external_id || null,
    gameStartsAt: contest.game_starts_at || null,
    gameDate: contest.game_starts_at || contest.settings?.dates,
  };
  const { data: publishedRows, error: publishError } = await admin.rpc('gridone_publish_board', {
    p_contest_id: contest.id,
    p_owner_id: authData.user.id,
    p_expected_revision: contest.revision,
    p_side_axis: sideAxis,
    p_top_axis: topAxis,
    p_normalized_names: normalizedNames,
    p_public_board: publicBoard,
    p_matchup: matchup,
  });
  if (publishError) {
    const message = publishError.message || 'The board could not be published.';
    const status = /activation/i.test(message)
      ? 402
      : /scheduled NFL game|axis|100 squares/i.test(message)
        ? 409
        : 500;
    return Response.json({ error: message }, { status });
  }
  const published = Array.isArray(publishedRows) ? publishedRows[0] : publishedRows;
  if (!published) {
    return Response.json({
      error: 'This board changed before publication. Reload and try again.',
      code: 'REVISION_CONFLICT',
    }, { status: 409 });
  }
  return Response.json({
    published: true,
    shareCode: published.share_code,
    viewerUrl: `/b/${published.share_code}`,
    revision: published.next_revision,
  });
};
