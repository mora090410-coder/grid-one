import {
  fetchScheduledGameById,
  fetchScheduledGames,
  type ScheduledGame,
} from '../_lib/espnNfl';
import { scoreTestModeAllowed } from '../_lib/scoreTestMode';
import {
  PayoutDescriptionsValidationError,
  type PayoutDescriptions,
  validatePayoutDescriptions,
} from '../_lib/payoutDescriptions';

import { canonicalizeGameSettings, legacyDateFromKickoff } from '../_lib/matchup';
import {
  adminClient,
  bearerToken,
  currentSeason,
  jsonResponse,
  maskedError,
  readJsonObject,
  userClient,
  verifyUser,
  type PagesFunction,
} from '../_lib/http';

import { validDraftAxisMode } from '../../utils/quarterAxes';
import { isValidAxis } from '../../utils/boardValidation';

// A 100-square board with names, payout text and quarter numbers is far below this.
const MAX_CREATE_BODY_BYTES = 256 * 1024;

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
    payoutDescriptions?: PayoutDescriptions;
    [key: string]: unknown;
  };
  board: {
    squares: unknown[];
    leftAxis?: Array<number | null>;
    topAxis?: Array<number | null>;
    [key: string]: unknown;
  };
}

export { scoreTestModeAllowed };

// Re-exported for existing consumers; the shared copy lives in _lib/matchup.
export { canonicalizeGameSettings, legacyDateFromKickoff };

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
  if (!validDraftAxisMode(candidate.board)) throw new Error('Invalid number mode or quarter axis shape.');
  const payoutDescriptions = validatePayoutDescriptions(
    candidate.game?.payoutDescriptions ?? {},
  );
  const sanitizedGame: Record<string, unknown> = {
    ...candidate.game,
    payoutDescriptions,
  };
  delete sanitizedGame.payouts;
  delete sanitizedGame.payout_labels;
  return {
    ...candidate,
    game: sanitizedGame,
  } as CreateBoardPayload;
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const bearer = bearerToken(request);
    if (!bearer) return jsonResponse({ error: 'Sign in before creating a board.' }, 401);

    const body = await readJsonObject(request, MAX_CREATE_BODY_BYTES);
    if (body instanceof Response) return body;
    const payload = validate(body);
    const supabase = userClient(env, bearer);
    const user = await verifyUser(supabase, bearer, { expired: 'Your session has expired. Sign in again.' });
    if (user instanceof Response) return user;
    const scoreTestGateOpen = payload.scoreTestMode === true
      && scoreTestModeAllowed(env, user.id);

    let scheduledGame: ScheduledGame | null;
    try {
      scheduledGame = await fetchScheduledGameById(payload.game.gameExternalId);
    } catch {
      return jsonResponse({
        error: 'The NFL schedule provider is unavailable. Retry in a moment.',
      }, 503);
    }
    if (!scheduledGame) {
      return jsonResponse({
        error: 'That NFL game could not be verified. Choose a scheduled game and try again.',
      }, 400);
    }
    const scoreTestMode = scoreTestGateOpen && scheduledGame.state !== 'pre';
    if (scheduledGame.state !== 'pre') {
      if (!scoreTestMode) {
        return jsonResponse({
          error: 'Choose an upcoming NFL game.',
        }, 400);
      }
      let recentCompleted: ScheduledGame[];
      try {
        recentCompleted = await fetchScheduledGames({ scope: 'completed', limit: 5 });
      } catch {
        return jsonResponse({
          error: 'The completed-game test list is unavailable. Retry in a moment.',
        }, 503);
      }
      if (!recentCompleted.some((game) => game.id === scheduledGame.id)) {
        return jsonResponse({
          error: 'Score-test boards are limited to the five most recent completed NFL games.',
        }, 400);
      }
    }
    const game = canonicalizeGameSettings({
      ...payload.game,
      title: payload.game.title.trim(),
    }, scheduledGame);
    // SQL compatibility columns are a constrained pair; board_data retains literal evidence.
    const validPair = isValidAxis(payload.board.leftAxis) && isValidAxis(payload.board.topAxis);
    const sideAxis = validPair ? payload.board.leftAxis : null;
    const topAxis = validPair ? payload.board.topAxis : null;
    if (scoreTestMode && !env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server configuration is incomplete.' }, 503);
    }
    const writeClient = scoreTestMode
      ? adminClient(env)
      : supabase;

    const { data, error } = await writeClient
      .from('contests')
      .insert({
        owner_id: user.id,
        score_test_mode: scoreTestMode,
        title: game.title,
        season_year: currentSeason(env),
        game_external_id: scheduledGame.id,
        game_starts_at: scheduledGame.kickoffAt,
        side_team_abbr: scheduledGame.awayTeam.abbr,
        side_team_name: scheduledGame.awayTeam.name,
        top_team_abbr: scheduledGame.homeTeam.abbr,
        top_team_name: scheduledGame.homeTeam.name,
        side_axis: sideAxis,
        top_axis: topAxis,
        payout_labels: {},
        payout_descriptions: game.payoutDescriptions || {},
        settings: game,
        board_data: payload.board,
      })
      .select('id, share_code, revision')
      .single();

    if (error) throw error;
    return jsonResponse({
      success: true,
      boardId: data.id,
      shareCode: data.share_code,
      revision: data.revision,
      poolId: data.id,
    }, 201);
  } catch (error: any) {
    const message = error?.message || 'Unable to create the board.';
    const validationError = error instanceof PayoutDescriptionsValidationError
      || /board name|100 squares|invalid request|scheduled NFL game|invalid number mode or quarter axis shape/i.test(message);
    if (validationError) return jsonResponse({ error: message }, 400);
    return maskedError('Board creation failed', error, 'Unable to create the board. Please try again.');
  }
};
