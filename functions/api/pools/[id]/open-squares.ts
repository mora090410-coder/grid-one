import {
  normalizeOpenSquareCells,
  OpenSquaresValidationError,
} from '../../../_lib/openSquares';
import { adminClient, isUuid, maskedError, requireUser, type PagesFunction } from '../../../_lib/http';

const ASSIGN_FAILED = 'The open squares could not be assigned. Please try again.';

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Late square assignment is not configured.' }, { status: 503 });
  }

  const contestId = String(params.id || '');
  if (!isUuid(contestId)) {
    return Response.json({ error: 'Invalid board ID.' }, { status: 400 });
  }

  const user = await requireUser(request, env, { missing: 'Sign in before assigning squares.', expired: 'Your session has expired.' });
  if (user instanceof Response) return user;

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const body = parsedBody as { revision?: unknown; squares?: unknown };
  if (!Number.isInteger(body.revision) || Number(body.revision) < 1) {
    return Response.json({ error: 'A current board revision is required.' }, { status: 409 });
  }

  let normalizedNames: string[][];
  try {
    normalizedNames = normalizeOpenSquareCells(body.squares);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid square assignments.';
    return Response.json({ error: message }, {
      status: error instanceof OpenSquaresValidationError ? 400 : 500,
    });
  }

  const admin = adminClient(env);
  const { data: contest, error: contestError } = await admin
    .from('contests')
    .select('id, revision')
    .eq('id', contestId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (contestError) return maskedError('Open-square contest lookup failed', contestError, ASSIGN_FAILED);
  if (!contest) return Response.json({ error: 'Board not found.' }, { status: 404 });
  if (contest.revision !== body.revision) {
    return Response.json({
      error: 'This board changed in another session. Reload before assigning more squares.',
      code: 'REVISION_CONFLICT',
      currentRevision: contest.revision,
    }, { status: 409 });
  }

  const { data, error } = await admin.rpc('gridone_fill_open_squares', {
    p_contest_id: contestId,
    p_owner_id: user.id,
    p_expected_revision: body.revision,
    p_normalized_names: normalizedNames,
  });
  if (error) {
    const message = error.message || 'The open squares could not be assigned.';
    if (/frozen at kickoff|kickoff is unavailable/i.test(message)) {
      return Response.json({ error: message, code: 'KICKOFF_FROZEN' }, { status: 409 });
    }
    if (/occupied squares|open-square published board|assign at least one/i.test(message)) {
      return Response.json({ error: message, code: 'BOARD_LOCKED' }, { status: 409 });
    }
    if (/100 squares|purchaser name/i.test(message)) {
      return Response.json({ error: message }, { status: 400 });
    }
    return maskedError('Open-square assignment failed', error, ASSIGN_FAILED);
  }

  const updated = Array.isArray(data) ? data[0] : data;
  if (!updated) {
    return Response.json({
      error: 'This board changed in another session. Reload before assigning more squares.',
      code: 'REVISION_CONFLICT',
      currentRevision: contest.revision,
    }, { status: 409 });
  }

  return Response.json({
    success: true,
    revision: updated.next_revision,
    updatedAt: updated.contest_updated_at,
    filledCount: Number(updated.filled_count),
  });
};
