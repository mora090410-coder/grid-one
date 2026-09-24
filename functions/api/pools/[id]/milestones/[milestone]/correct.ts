import { adminClient, isUuid, maskedError, readJsonObject, requireUser, type PagesFunction } from '../../../../../_lib/http';

const milestones = new Set(['Q1', 'Q2', 'Q3', 'FINAL']);
const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Milestone correction is not configured.' }, 503);
  }
  const contestId = String(params.id || '');
  if (!isUuid(contestId)) return json({ error: 'Invalid board ID.' }, 400);
  const milestone = String(params.milestone || '').toUpperCase();
  if (!milestones.has(milestone)) {
    return json({ error: 'Choose Q1, Q2, Q3, or FINAL.' }, 400);
  }

  const user = await requireUser(request, env, { missing: 'Sign in before correcting a result.', expired: 'Your session has expired.' });
  if (user instanceof Response) return user;

  const parsed = await readJsonObject(request, 16_384);
  if (parsed instanceof Response) return parsed;
  const body = parsed as {
    expectedVersion?: number;
    sideScore?: number;
    topScore?: number;
    reason?: string;
  };
  const expectedVersion = Number(body.expectedVersion);
  const sideScore = Number(body.sideScore);
  const topScore = Number(body.topScore);
  const reason = String(body.reason || '').trim();
  if (
    !Number.isInteger(expectedVersion)
    || expectedVersion < 1
    || !Number.isInteger(sideScore)
    || sideScore < 0
    || sideScore > 255
    || !Number.isInteger(topScore)
    || topScore < 0
    || topScore > 255
    || reason.length < 3
    || reason.length > 500
  ) {
    return json({ error: 'Enter the current version, corrected scores, and a public reason.' }, 400);
  }

  const { data, error } = await adminClient(env).rpc('gridone_correct_milestone', {
    p_contest_id: contestId,
    p_owner_id: user.id,
    p_milestone: milestone,
    p_expected_version: expectedVersion,
    p_side_score: sideScore,
    p_top_score: topScore,
    p_reason: reason,
  });
  if (error) {
    if (/version|stale|already corrected/i.test(error.message || '')) {
      return json({ error: 'This result changed before your correction was saved. Reload and review the latest version.' }, 409);
    }
    // Domain refusals raised by gridone_correct_milestone stay readable.
    if (/Milestone has not been confirmed/i.test(error.message || '')) {
      return json({ error: 'This result has not been confirmed yet, so it cannot be corrected.' }, 409);
    }
    if (/Published board not found/i.test(error.message || '')) return json({ error: 'Board not found.' }, 404);
    return maskedError('Milestone correction failed', error, 'The correction could not be saved. Please try again.');
  }
  const result = Array.isArray(data) ? data[0] : data;
  return json({
    resolution: result?.resolution || null,
    winnerHistory: Array.isArray(result?.winner_history) ? result.winner_history : [],
    pendingMilestones: Array.isArray(result?.pending_milestones) ? result.pending_milestones : [],
    correctionDeliveriesQueued: Array.isArray(result?.delivery_ids)
      ? result.delivery_ids.length
      : 0,
  });
};
