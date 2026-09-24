import { findVisibleSalesBoard, validateAllocationLabels, validateParticipation, validateSalesBoard } from '../../_lib/pregameBoard';
import {
  fetchScheduledGameById,
  type ScheduledGame,
} from '../../_lib/espnNfl';
import {
  findVisiblePublicBoard,
  publicBoardNotFoundResponse,
} from '../../_lib/publicBoardVisibility';
import { hasBoardActivation } from '../../../utils/boardActivation';
import {
  PayoutDescriptionsValidationError,
  validatePayoutDescriptions,
} from '../../_lib/payoutDescriptions';
import { canonicalizeGameSettings, legacyDateFromKickoff } from '../../_lib/matchup';
import {
  adminClient,
  authenticate,
  authUnavailableBody,
  bearerToken,
  currentSeason,
  DEFAULT_SEASON,
  jsonResponse,
  maskedError,
  readJsonObject,
  SHARE_CODE_PATTERN as sharePattern,
  userClient,
  UUID_PATTERN as uuidPattern,
  type PagesFunction,
} from '../../_lib/http';

interface Env {
  PUBLIC_SITE_URL?: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GRIDONE_SEASON?: string;
}

// A 100-square board with names, payout text and quarter numbers is far below this.
const MAX_BOARD_BODY_BYTES = 256 * 1024;
const LOAD_FAILED = 'Unable to load the board. Please try again.';
const SAVE_FAILED = 'Unable to save the board. Please try again.';
const PAYOUT_SAVE_FAILED = 'Unable to save payout descriptions. Please try again.';

// Kept under its historical name for existing consumers; one implementation lives in _lib/matchup.
export const canonicalizeUpdatedGame = canonicalizeGameSettings;

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

export const matchupDiffers = (stored: StoredMatchup, scheduled: ScheduledGame, seasonYear = DEFAULT_SEASON) =>
  stored.game_external_id !== scheduled.id
  || !sameInstant(stored.game_starts_at, scheduled.kickoffAt)
  || stored.season_year !== seasonYear
  || stored.side_team_name !== scheduled.awayTeam.name
  || stored.side_team_abbr !== scheduled.awayTeam.abbr
  || stored.top_team_name !== scheduled.homeTeam.name
  || stored.top_team_abbr !== scheduled.homeTeam.abbr;

const storedScheduledGame = (
  stored: StoredMatchup,
  requestedExternalId: string,
  seasonYear: number,
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
      : seasonYear,
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
  return adminClient(env);
};

/** Owner identity for board edits: the user id, or the 401/503 to return. */
const requireOwner = async (
  request: Request,
  env: Env,
): Promise<{ response: Response } | { response: null; bearer: string; userId: string }> => {
  const bearer = bearerToken(request);
  if (!bearer) return { response: jsonResponse({ error: 'Sign in to edit this board.' }, 401) };
  const auth = await authenticate(userClient(env, bearer), bearer);
  if (!('user' in auth)) {
    return {
      response: auth.failure === 'unavailable'
        ? jsonResponse(authUnavailableBody(), 503)
        : jsonResponse({ error: 'Sign in to edit this board.' }, 401),
    };
  }
  return { response: null, bearer, userId: auth.user.id };
};

/** Failures from the service layer: configuration → 503, anything else masked 500. */
const serverFailure = (context: string, error: any, message: string) => (
  /configuration/i.test(error?.message || '')
    ? jsonResponse({ error: error.message }, 503)
    : maskedError(context, error, message)
);

export const onRequestGet: PagesFunction = async ({ request, env, params }) => {
  const id = String(params.id || '').toUpperCase();
  try {
    const admin = requireServiceClient(env);
    // Only a board id can name an owner view; the public share-code path never needs identity.
    let ownerId: string | null = null;
    const bearer = uuidPattern.test(id) ? bearerToken(request) : null;
    if (bearer) {
      const auth = await authenticate(userClient(env, bearer), bearer);
      if ('user' in auth) ownerId = auth.user.id;
      else if (auth.failure === 'unavailable') return jsonResponse(authUnavailableBody(), 503);
    }

    if (ownerId) {
      const { data, error } = await admin
        .from('contests')
        .select('id, share_code, owner_id, title, status, revision, updated_at, score_test_mode, settings, board_data, payout_descriptions, shared_at, published_at, game_external_id, game_starts_at, side_team_name, side_team_abbr, top_team_name, top_team_abbr, board_activations(id)')
        .eq('id', id)
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: 'Board not found.' }, 404);
      const [
        { data: publicSnapshot, error: publicSnapshotError },
        { data: scoreState, error: scoreStateError },
        { data: terminalDeliveries, error: terminalDeliveriesError },
      ] = await Promise.all([
        admin
          .from('public_board_snapshots')
          .select('winner_history, pending_milestones, score, organization_display_name')
          .eq('contest_id', data.id)
          .maybeSingle(),
        admin
          .from('contest_score_state')
          .select('scoring_mode, current_snapshot_id')
          .eq('contest_id', data.id)
          .maybeSingle(),
        admin
          .from('notification_deliveries')
          .select('id, notification_kind, attempt_count, last_error, terminal_at, milestone_resolutions!inner(contest_id, milestone)')
          .eq('milestone_resolutions.contest_id', data.id)
          .eq('status', 'failed_permanent')
          .order('terminal_at', { ascending: false })
          .limit(20),
      ]);
      if (publicSnapshotError) throw publicSnapshotError;
      if (scoreStateError) throw scoreStateError;
      if (terminalDeliveriesError) throw terminalDeliveriesError;
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
      return jsonResponse({
        // Saved display settings can contain old transport fields. The canonical
        // contest columns below must always win, especially its save revision.
        ...(data.settings || {}),
        id: data.id,
        share_code: data.share_code,
        owner_id: data.owner_id,
        title: data.title,
        organizationDisplayName: publicSnapshot?.organization_display_name || undefined,
        status: data.status,
        revision: data.revision,
        updated_at: data.updated_at,
        scoreTestMode: data.score_test_mode === true,
        payoutDescriptions: data.payout_descriptions || {},
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
        is_activated: hasBoardActivation(data.board_activations),
        locked: Boolean(data.published_at),
        published_at: data.published_at,
        shared_at: data.shared_at,
        winner_history: publicSnapshot?.winner_history || [],
        pending_milestones: publicSnapshot?.pending_milestones || [],
        notification_delivery_issues: (terminalDeliveries || []).map((delivery: any) => ({
          id: delivery.id,
          notificationKind: delivery.notification_kind,
          milestone: Array.isArray(delivery.milestone_resolutions)
            ? delivery.milestone_resolutions[0]?.milestone
            : delivery.milestone_resolutions?.milestone,
          attemptCount: delivery.attempt_count,
          error: delivery.last_error,
          terminalAt: delivery.terminal_at,
        })),
        score: currentScore,
        scoreSnapshot: currentScore,
        useManualScores,
        manualQuarterScores: useManualScores ? currentScore?.quarterScores : undefined,
        manualLeftScore: useManualScores ? currentScore?.leftScore : undefined,
        manualTopScore: useManualScores ? currentScore?.topScore : undefined,
        manualPeriod: useManualScores ? currentScore?.period : undefined,
        manualGameState: useManualScores ? currentScore?.state : undefined,
      }, 200);
    }

    if (!sharePattern.test(id)) {
      return publicBoardNotFoundResponse();
    }

    const publicProjection = {
      snapshot: 'share_code, revision, board_title, organization_display_name, matchup, board, score, winner_history, pending_milestones, payout_descriptions, score_test_mode, published_at, updated_at',
      contest: 'id, status',
    };
    let visibleBoard = await findVisiblePublicBoard(admin, id, publicProjection);
    if (!visibleBoard) {
      const salesBoard = await findVisibleSalesBoard(admin, id);
      if (salesBoard) return jsonResponse(salesBoard, 200);
      // Finalization can commit between these reads. Resolve the same link again
      // before declaring it unavailable, without exposing unshared drafts.
      visibleBoard = await findVisiblePublicBoard(admin, id, publicProjection);
      if (!visibleBoard) return publicBoardNotFoundResponse();
    }
    const data = visibleBoard.snapshot;

    const matchup = data.matchup || {};
    return jsonResponse({
      share_code: data.share_code,
      stage: 'finalized',
      title: data.board_title,
      organizationDisplayName: data.organization_display_name || undefined,
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
      pending_milestones: data.pending_milestones,
      payoutDescriptions: data.payout_descriptions || {},
      scoreTestMode: data.score_test_mode === true,
      is_activated: true,
      locked: false,
    }, 200);
  } catch (error: any) {
    return serverFailure('Board read failed', error, LOAD_FAILED);
  }
};

export const onRequestPatch: PagesFunction = async ({ request, env, params }) => {
  const id = String(params.id || '');
  if (!uuidPattern.test(id)) return jsonResponse({ error: 'Invalid board ID.' }, 400);

  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const parsedBody = await readJsonObject(request, MAX_BOARD_BODY_BYTES);
    if (parsedBody instanceof Response) return parsedBody;
    const body = parsedBody as { payoutDescriptions?: unknown; revision?: number };
    if (!Object.prototype.hasOwnProperty.call(body, 'payoutDescriptions')) {
      return jsonResponse({ error: 'No payout descriptions were provided.' }, 400);
    }
    if (!Number.isInteger(body.revision) || Number(body.revision) < 1) {
      return jsonResponse({ error: 'A current board revision is required.' }, 409);
    }
    const payoutDescriptions = validatePayoutDescriptions(body.payoutDescriptions);

    const ownerClient = userClient(env, auth.bearer);
    const { data: currentContest, error: currentError } = await ownerClient
      .from('contests')
      .select('revision')
      .eq('id', id)
      .eq('owner_id', auth.userId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!currentContest) return jsonResponse({ error: 'Board not found.' }, 404);
    if (currentContest.revision !== body.revision) {
      return jsonResponse({
        error: 'This board changed in another session. Reload before saving again.',
        code: 'REVISION_CONFLICT',
        currentRevision: currentContest.revision,
      }, 409);
    }

    const admin = requireServiceClient(env);
    const { data: rpcData, error: rpcError } = await admin.rpc(
      'gridone_update_payout_descriptions',
      {
        p_contest_id: id,
        p_owner_id: auth.userId,
        p_expected_revision: body.revision,
        p_payout_descriptions: payoutDescriptions,
      },
    );
    if (rpcError) throw rpcError;
    const updated = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!updated) {
      return jsonResponse({
        error: 'This board changed in another session. Reload before saving again.',
        code: 'REVISION_CONFLICT',
        currentRevision: currentContest.revision,
      }, 409);
    }

    return jsonResponse({
      ok: true,
      revision: updated.next_revision,
      updatedAt: updated.contest_updated_at,
      payoutDescriptions: updated.payout_descriptions || {},
    }, 200);
  } catch (error: any) {
    if (error instanceof PayoutDescriptionsValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    return serverFailure('Payout description save failed', error, PAYOUT_SAVE_FAILED);
  }
};

export const onRequestPut: PagesFunction = async ({ request, env, params }) => {
  const id = String(params.id || '');
  if (!uuidPattern.test(id)) return jsonResponse({ error: 'Invalid board ID.' }, 400);

  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const parsedBody = await readJsonObject(request, MAX_BOARD_BODY_BYTES);
    if (parsedBody instanceof Response) return parsedBody;
    const body = parsedBody as { game?: Record<string, unknown>; board?: Record<string, unknown>; revision?: number };
    if (!body.game && !body.board) return jsonResponse({ error: 'No board changes were provided.' }, 400);
    if (!Number.isInteger(body.revision) || Number(body.revision) < 1) {
      return jsonResponse({ error: 'A current board revision is required.' }, 409);
    }

    const client = userClient(env, auth.bearer);
    const { data: currentContest, error: currentError } = await client
      .from('contests')
      .select('shared_at, published_at, status, revision, title, payout_labels, board_data, settings, game_external_id, game_starts_at, season_year, side_team_name, side_team_abbr, top_team_name, top_team_abbr')
      .eq('id', id)
      .eq('owner_id', auth.userId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!currentContest) return jsonResponse({ error: 'Board not found.' }, 404);
    if (body.board) {
      const validationError = currentContest.shared_at && !currentContest.published_at
        ? validateSalesBoard(body.board)
        : validateAllocationLabels(body.board.allocationLabels) || validateParticipation(body.board);
      if (validationError) return jsonResponse({ error: validationError }, 400);
    }
    if (currentContest.published_at && body.board && JSON.stringify(body.board) !== JSON.stringify(currentContest.board_data)) {
      return jsonResponse({
        error: 'Published assignments and number axes are locked.',
        code: 'BOARD_LOCKED',
      }, 409);
    }

    if (body.game) {
      const gameExternalId = typeof body.game.gameExternalId === 'string'
        ? body.game.gameExternalId.trim()
        : '';
      if (!gameExternalId) {
        return jsonResponse({
          error: 'Choose a scheduled NFL game before saving.',
        }, 400);
      }
      const title = typeof body.game.title === 'string' ? body.game.title.trim() : '';
      if (!title || title.length > 100) {
        return jsonResponse({
          error: 'Board name must be between 1 and 100 characters.',
        }, 400);
      }
      const payoutLabels = currentContest.payout_labels || {};

      const seasonYear = currentSeason(env);
      let scheduledGame = storedScheduledGame(currentContest, gameExternalId, seasonYear);
      if (!scheduledGame) {
        try {
          scheduledGame = await fetchScheduledGameById(gameExternalId);
        } catch {
          return jsonResponse({
            error: 'The NFL schedule provider is unavailable. Retry in a moment.',
          }, 503);
        }
      }
      if (!scheduledGame) {
        return jsonResponse({
          error: 'That NFL game could not be verified. Choose a scheduled game and try again.',
        }, 400);
      }

      if (currentContest.published_at && matchupDiffers(currentContest, scheduledGame, seasonYear)) {
        return jsonResponse({
          error: 'The game on a published board cannot be changed.',
          code: 'MATCHUP_LOCKED',
        }, 409);
      }

      const submittedGame = { ...body.game };
      delete submittedGame.payouts;
      delete submittedGame.payout_labels;
      const settings = canonicalizeGameSettings({ ...submittedGame, title }, scheduledGame);
      const admin = requireServiceClient(env);
      const { data: rpcData, error: rpcError } = await admin.rpc('gridone_update_draft_matchup', {
        p_contest_id: id,
        p_owner_id: auth.userId,
        p_expected_revision: body.revision,
        p_game_external_id: scheduledGame.id,
        p_game_starts_at: scheduledGame.kickoffAt,
        p_season_year: seasonYear,
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
          return jsonResponse({
            error: 'The game on a published board cannot be changed.',
            code: 'MATCHUP_LOCKED',
          }, 409);
        }
        throw rpcError;
      }
      const updated = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!updated) {
        return jsonResponse({
          error: 'This board changed in another session. Reload before saving again.',
          code: 'REVISION_CONFLICT',
          currentRevision: currentContest.revision,
        }, 409);
      }
      return jsonResponse({
        ok: true,
        revision: updated.next_revision,
        updatedAt: updated.contest_updated_at,
        matchupChanged: updated.matchup_changed,
      }, 200);
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
      return jsonResponse({
        error: 'This board changed in another session. Reload before saving again.',
        code: 'REVISION_CONFLICT',
        currentRevision: currentContest.revision,
      }, 409);
    }
    return jsonResponse({ ok: true, revision: data.revision, updatedAt: data.updated_at }, 200);
  } catch (error: any) {
    return serverFailure('Board save failed', error, SAVE_FAILED);
  }
};
