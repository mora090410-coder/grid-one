import { validateAllocationLabels } from '../../../_lib/pregameBoard';
import { hasValidAxes, isValidAxis } from '../../../../utils/boardValidation';
import { projectQuarterAxes, validDraftAxisMode } from '../../../../utils/quarterAxes';
import { getAxisForQuarter } from '../../../../utils/winnerLogic';
import { photoOrientationResolved } from '../../../../utils/photoOrientation';
import { allowanceErrorResponse } from '../../../_lib/pricingTiers';
import { adminClient, isUuid, maskedError, requireUser, type PagesFunction } from '../../../_lib/http';

const PUBLISH_FAILED = 'The board could not be published. Please try again.';

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Publishing is not configured.' }, { status: 503 });
  const contestId = String(params.id || '');
  if (!isUuid(contestId)) return Response.json({ error: 'Invalid board ID.' }, { status: 400 });
  const user = await requireUser(request, env, { missing: 'Sign in before publishing.', expired: 'Your session has expired.' });
  if (user instanceof Response) return user;
  if (!user.email || !user.email_confirmed_at) {
    return Response.json({ error: 'Verify your email before publishing your free board.' }, { status: 403 });
  }
  // An empty body means "no open-square opt-in"; a JSON null or array does too.
  const parsed: unknown = await request.json().catch(() => ({}));
  const body = (parsed && typeof parsed === 'object' ? parsed : {}) as { allowOpenSquares?: unknown };
  if (
    Object.prototype.hasOwnProperty.call(body, 'allowOpenSquares')
    && typeof body.allowOpenSquares !== 'boolean'
  ) {
    return Response.json({ error: 'Open-square confirmation must be true or false.' }, { status: 400 });
  }
  const allowOpenSquares = body.allowOpenSquares === true;

  const admin = adminClient(env);
  const { data: contest, error } = await admin
    .from('contests')
    .select('id, share_code, owner_id, title, revision, settings, board_data, published_at, side_axis, top_axis, side_team_name, side_team_abbr, top_team_name, top_team_abbr, game_external_id, game_starts_at, payout_labels')
    .eq('id', contestId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (error) return maskedError('Publish contest lookup failed', error, PUBLISH_FAILED);
  if (!contest) return Response.json({ error: 'Board not found.' }, { status: 404 });
  const storedBoard = contest.board_data || {};
  if (!photoOrientationResolved(storedBoard, {topAbbr:contest.top_team_abbr || contest.settings?.topAbbr, leftAbbr:contest.side_team_abbr || contest.settings?.leftAbbr})) {
    return Response.json({error:'Review and resolve the photo team orientation before publishing.'},{status:409});
  }
  // Fixed legacy columns remain authoritative fallback evidence. Never use this for dynamic sets.
  const board = storedBoard.isDynamic === true ? storedBoard : {
    ...storedBoard,
    leftAxis: isValidAxis(storedBoard.leftAxis) ? storedBoard.leftAxis : contest.side_axis,
    topAxis: isValidAxis(storedBoard.topAxis) ? storedBoard.topAxis : contest.top_axis,
  };
  if (!validDraftAxisMode(board)) return Response.json({ error: 'Invalid number mode or quarter axis shape.' }, { status: 409 });
  const allocationError = validateAllocationLabels(board.allocationLabels);
  if (allocationError) return Response.json({ error: allocationError }, { status: 409 });
  const sideAxis = getAxisForQuarter(board, 'left', 'Q1');
  const topAxis = getAxisForQuarter(board, 'top', 'Q1');
  if (!hasValidAxes(board)) {
    return Response.json({ error: 'Draw all ten unique axis digits before publishing.' }, { status: 409 });
  }
  if (!Array.isArray(board.squares) || board.squares.length !== 100) {
    return Response.json({ error: 'The board must contain exactly 100 squares.' }, { status: 409 });
  }
  const normalizedNames = board.squares.map((cell: unknown) =>
    Array.isArray(cell) ? cell.filter((name) => typeof name === 'string' && name.trim()).map((name) => String(name).trim()) : [],
  );
  const unassigned = normalizedNames.filter((names: string[]) => !names.length).length;
  const persistedOpenSquareOptIn = board.allowOpenSquares === true;
  const effectiveOpenSquareOptIn = allowOpenSquares && persistedOpenSquareOptIn;
  if (unassigned === 100) {
    return Response.json({ error: 'Assign at least one square before publishing.' }, { status: 409 });
  }
  if (unassigned && !effectiveOpenSquareOptIn) {
    return Response.json({ error: `${unassigned} squares are still unassigned. Finish the board before publishing.` }, { status: 409 });
  }
  const multiplyAssigned = normalizedNames.filter((names: string[]) => names.length > 1).length;
  if (multiplyAssigned) {
    return Response.json({ error: `${multiplyAssigned} squares have more than one name. Use one purchaser identity per square before publishing.` }, { status: 409 });
  }

  const publicBoard = {
    leftAxis: sideAxis,
    topAxis: topAxis,
    squares: normalizedNames,
    ...(board.allocationLabels ? { allocationLabels: board.allocationLabels } : {}),
    ...projectQuarterAxes(board),
    allowOpenSquares: effectiveOpenSquareOptIn,
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
    p_owner_id: user.id,
    p_expected_revision: contest.revision,
    p_side_axis: sideAxis,
    p_top_axis: topAxis,
    p_normalized_names: normalizedNames,
    p_public_board: publicBoard,
    p_matchup: matchup,
    p_allow_open_squares: effectiveOpenSquareOptIn,
  });
  if (publishError) {
    const message = publishError.message || 'The board could not be published.';
    if (message.includes('guest_holds_active')) return Response.json({
      code: 'ACTIVE_GUEST_HOLDS',
      error: 'Guests are choosing squares. Wait for their holds to finish, or cancel holds in Guest claim links before locking numbers.',
    }, { status: 409 });
    if (message.includes('guest_square_conflict') || message.includes('guest_snapshot_conflict')) return Response.json({
      code: 'REVISION_CONFLICT',
      error: 'Guest claims changed this board. Reload the latest board before locking numbers.',
    }, { status: 409 });
    const allowance = allowanceErrorResponse(message);
    if (allowance) return allowance;
    if (/scheduled NFL game|axis|100 squares|open square|purchaser name/i.test(message)) {
      return Response.json({ error: message }, { status: 409 });
    }
    return maskedError('Publish RPC failed', publishError, PUBLISH_FAILED);
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
