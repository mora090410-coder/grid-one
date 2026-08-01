import { createClient } from '@supabase/supabase-js';
import {
  normalizeOpenSquareCells,
  OpenSquaresValidationError,
} from '../../../_lib/openSquares';

type PagesFunction = (context: any) => Promise<Response> | Response;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Late square assignment is not configured.' }, { status: 503 });
  }

  const contestId = String(params.id || '');
  if (!uuidPattern.test(contestId)) {
    return Response.json({ error: 'Invalid board ID.' }, { status: 400 });
  }

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Sign in before assigning squares.' }, { status: 401 });

  const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await auth.auth.getUser(token);
  if (!authData.user) return Response.json({ error: 'Your session has expired.' }, { status: 401 });

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

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: contest, error: contestError } = await admin
    .from('contests')
    .select('id, revision')
    .eq('id', contestId)
    .eq('owner_id', authData.user.id)
    .maybeSingle();
  if (contestError) return Response.json({ error: contestError.message }, { status: 500 });
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
    p_owner_id: authData.user.id,
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
    return Response.json({ error: message }, { status: 500 });
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
