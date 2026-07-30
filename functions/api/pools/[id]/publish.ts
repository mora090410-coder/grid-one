import { createClient } from '@supabase/supabase-js';
import { isValidAxis } from '../../../../utils/boardValidation';
import { nextUpgradeTier, type PricingTier } from '../../../_lib/pricingTiers';

type PagesFunction = (context: any) => Promise<Response> | Response;

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Publishing is not configured.' }, { status: 503 });
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Sign in before publishing.' }, { status: 401 });
  const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await auth.auth.getUser(token);
  if (!authData.user) return Response.json({ error: 'Your session has expired.' }, { status: 401 });
  if (!authData.user.email || !authData.user.email_confirmed_at) {
    return Response.json({ error: 'Verify your email before publishing your free board.' }, { status: 403 });
  }

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: contest, error } = await admin
    .from('contests')
    .select('id, share_code, owner_id, title, revision, settings, board_data, published_at, side_axis, top_axis, side_team_name, side_team_abbr, top_team_name, top_team_abbr, game_external_id, game_starts_at, payout_labels')
    .eq('id', String(params.id || ''))
    .eq('owner_id', authData.user.id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!contest) return Response.json({ error: 'Board not found.' }, { status: 404 });
  const board = contest.board_data || {};
  const sideAxis = isValidAxis(board.bearsAxis) ? board.bearsAxis : contest.side_axis;
  const topAxis = isValidAxis(board.oppAxis) ? board.oppAxis : contest.top_axis;
  if (!isValidAxis(sideAxis) || !isValidAxis(topAxis)) {
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
    const allowanceMatch = message.match(
      /PUBLISH_(ALLOWANCE_EXHAUSTED|ENTITLEMENT_INACTIVE):([^:]+):(\d+):(\d+)/i,
    );
    if (allowanceMatch) {
      const [, reason, tierValue, usedValue, allowanceValue] = allowanceMatch;
      const tier = tierValue.toLowerCase() as PricingTier;
      const used = Number(usedValue);
      const allowance = Number(allowanceValue);
      const upgradeTo = reason.toUpperCase() === 'ENTITLEMENT_INACTIVE'
        ? tier === 'org'
          ? 'org'
          : 'gameday'
        : nextUpgradeTier(tier);
      const code = reason.toUpperCase() === 'ENTITLEMENT_INACTIVE'
        ? 'PUBLISH_ENTITLEMENT_INACTIVE'
        : 'PUBLISH_ALLOWANCE_EXHAUSTED';
      return Response.json({
        code,
        error: upgradeTo === 'org'
          ? 'Your Game Day plan has published all 5 boards for this season.'
          : 'Your first board is live. Choose Game Day to publish another.',
        tier,
        used,
        allowance,
        upgradeTo,
      }, { status: 402 });
    }
    const status = /scheduled NFL game|axis|100 squares/i.test(message)
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
    tier: published.tier,
    used: Number(published.used),
    allowance: Number(published.allowance),
  });
};
