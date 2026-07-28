import { createClient } from '@supabase/supabase-js';
import { resolveMilestonesAndNotify } from '../../../../_lib/winnerNotifications';

type PagesFunction = (context: any) => Promise<Response> | Response;
type QuarterKey = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'OT';

const quarterKeys: QuarterKey[] = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'];
const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

const authenticatedOwner = async (request: Request, env: any, contestId: string) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { error: json({ error: 'Manual scoring is not configured.' }, 503) };
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: json({ error: 'Sign in before changing a score.' }, 401) };
  const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await auth.auth.getUser(token);
  if (!authData.user) return { error: json({ error: 'Your session has expired.' }, 401) };
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: contest } = await admin
    .from('contests')
    .select('id, status')
    .eq('id', contestId)
    .eq('owner_id', authData.user.id)
    .maybeSingle();
  if (!contest) return { error: json({ error: 'Board not found.' }, 404) };
  return { admin, user: authData.user, contest };
};

export const onRequestPost: PagesFunction = async ({ request, env, params, waitUntil }) => {
  const contestId = String(params.id || '');
  const owner = await authenticatedOwner(request, env, contestId);
  if (owner.error) return owner.error;
  const body = await request.json() as {
    quarterScores?: Record<QuarterKey, { left: number; top: number }>;
    period?: number;
    state?: 'pre' | 'in' | 'post';
    clock?: string;
  };
  const period = Number(body.period);
  const state = body.state;
  if (!Number.isInteger(period) || period < 0 || period > 5 || !['pre', 'in', 'post'].includes(String(state))) {
    return json({ error: 'Choose a valid game status and period.' }, 400);
  }
  const quarterScores = {} as Record<QuarterKey, { left: number; top: number }>;
  for (const key of quarterKeys) {
    const left = Number(body.quarterScores?.[key]?.left);
    const top = Number(body.quarterScores?.[key]?.top);
    if (!Number.isInteger(left) || !Number.isInteger(top) || left < 0 || top < 0 || left > 99 || top > 99) {
      return json({ error: `Enter valid points for ${key}.` }, 400);
    }
    quarterScores[key] = { left, top };
  }
  const total = (side: 'left' | 'top') => quarterKeys.reduce((sum, key) => sum + quarterScores[key][side], 0);
  const hasOvertimeScore = quarterScores.OT.left > 0 || quarterScores.OT.top > 0;
  const effectivePeriod = state === 'post' ? (hasOvertimeScore ? 5 : 4) : period;
  const now = new Date();
  const admin = owner.admin!;
  const { error: modeError } = await admin.from('contest_score_state').upsert({
    contest_id: contestId,
    scoring_mode: 'manual',
    manual_mode_started_at: now.toISOString(),
    manual_mode_started_by: owner.user!.id,
    updated_at: now.toISOString(),
  }, { onConflict: 'contest_id' });
  if (modeError) return json({ error: modeError.message }, 500);
  const { data: snapshot, error: snapshotError } = await admin
    .from('score_snapshots')
    .insert({
      contest_id: contestId,
      source_mode: 'manual',
      provider: 'organizer',
      game_state: state,
      period: effectivePeriod,
      side_score: total('left'),
      top_score: total('top'),
      quarter_scores: quarterScores,
      clock: String(body.clock || '').slice(0, 32),
      detail: 'Organizer-entered score',
      validation_status: 'accepted',
      source_name: 'Organizer',
      source_observed_at: now.toISOString(),
      retrieved_at: now.toISOString(),
      stale_after: new Date(now.getTime() + 31_536_000_000).toISOString(),
      created_by: owner.user!.id,
    })
    .select('*')
    .single();
  if (snapshotError) return json({ error: snapshotError.message }, 500);
  const { data: promoted, error: promoteError } = await admin.rpc('gridone_promote_score_snapshot', {
    p_contest_id: contestId,
    p_snapshot_id: snapshot.id,
  });
  if (promoteError || !promoted) return json({ error: promoteError?.message || 'The manual score could not become current.' }, 409);
  const publicScore = {
    leftScore: snapshot.side_score,
    topScore: snapshot.top_score,
    quarterScores: snapshot.quarter_scores,
    clock: snapshot.clock || '',
    period: snapshot.period,
    state: snapshot.game_state,
    detail: snapshot.detail,
    isOvertime: snapshot.period > 4,
    isManual: true,
    sourceName: 'Organizer',
    sourceObservedAt: snapshot.source_observed_at,
    retrievedAt: snapshot.retrieved_at,
    staleAfter: snapshot.stale_after,
    freshness: 'fresh',
  };
  await admin.from('public_board_snapshots').update({
    score: publicScore,
    updated_at: now.toISOString(),
  }).eq('contest_id', contestId);
  await admin.from('contest_audit_events').insert({
    contest_id: contestId,
    actor_id: owner.user!.id,
    event_type: 'score.manual_updated',
    entity_type: 'score_snapshot',
    entity_id: snapshot.id,
    details: { state, period: snapshot.period },
  });
  const winnerHistory = await resolveMilestonesAndNotify(
    admin,
    env,
    contestId,
    snapshot,
    { sendNotifications: false },
  ) || [];
  const resolutionWork = resolveMilestonesAndNotify(admin, env, contestId, snapshot);
  if (waitUntil) waitUntil(resolutionWork);
  else await resolutionWork;
  return json({ score: publicScore, winnerHistory });
};

export const onRequestDelete: PagesFunction = async ({ request, env, params }) => {
  const contestId = String(params.id || '');
  const owner = await authenticatedOwner(request, env, contestId);
  if (owner.error) return owner.error;
  const now = new Date().toISOString();
  const { error } = await owner.admin!.from('contest_score_state').upsert({
    contest_id: contestId,
    scoring_mode: 'automatic',
    manual_mode_started_at: null,
    manual_mode_started_by: null,
    updated_at: now,
  }, { onConflict: 'contest_id' });
  if (error) return json({ error: error.message }, 500);
  await owner.admin!.from('contest_audit_events').insert({
    contest_id: contestId,
    actor_id: owner.user!.id,
    event_type: 'score.automatic_enabled',
    details: {},
  });
  return json({ scoringMode: 'automatic' });
};
