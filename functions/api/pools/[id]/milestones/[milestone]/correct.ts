import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

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
  const milestone = String(params.milestone || '').toUpperCase();
  if (!milestones.has(milestone)) {
    return json({ error: 'Choose Q1, Q2, Q3, or FINAL.' }, 400);
  }

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in before correcting a result.' }, 401);
  const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await auth.auth.getUser(token);
  if (!authData.user) return json({ error: 'Your session has expired.' }, 401);

  const body = await request.json() as {
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

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc('gridone_correct_milestone', {
    p_contest_id: contestId,
    p_owner_id: authData.user.id,
    p_milestone: milestone,
    p_expected_version: expectedVersion,
    p_side_score: sideScore,
    p_top_score: topScore,
    p_reason: reason,
  });
  if (error) {
    const conflict = /version|stale|already corrected/i.test(error.message || '');
    return json({ error: conflict
      ? 'This result changed before your correction was saved. Reload and review the latest version.'
      : error.message }, conflict ? 409 : 500);
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
