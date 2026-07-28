import { createClient } from '@supabase/supabase-js';
import { resolveMilestonesAndNotify } from '../../../_lib/winnerNotifications';

type PagesFunction = (context: any) => Promise<Response> | Response;

interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GEMINI_API_KEY?: string;
  SCORE_MODEL?: string;
  PUBLIC_SITE_URL?: string;
}

type QuarterScore = { left: number; top: number };
type ProviderScore = {
  leftScore: number;
  topScore: number;
  quarterScores: Record<'Q1' | 'Q2' | 'Q3' | 'Q4' | 'OT', QuarterScore>;
  clock: string;
  period: number;
  state: 'pre' | 'in' | 'post';
  detail: string;
  isOvertime: boolean;
  sourceObservedAt: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sharePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const readWinnerHistory = async (admin: any, contestId: string) => {
  const { data, error } = await admin
    .from('public_board_snapshots')
    .select('winner_history')
    .eq('contest_id', contestId)
    .maybeSingle();
  if (error) {
    console.error('Winner history read failed:', error);
    return undefined;
  }
  return Array.isArray(data?.winner_history) ? data.winner_history : [];
};

const isIntegerScore = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255;

export const validateScore = (candidate: any): ProviderScore => {
  if (!candidate || !isIntegerScore(candidate.leftScore) || !isIntegerScore(candidate.topScore)) {
    throw new Error('Provider returned invalid score totals.');
  }
  if (!['pre', 'in', 'post'].includes(candidate.state) || !Number.isInteger(candidate.period) || candidate.period < 0 || candidate.period > 5) {
    throw new Error('Provider returned an invalid game state.');
  }
  const keys = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const;
  for (const key of keys) {
    if (!candidate.quarterScores?.[key] || !isIntegerScore(candidate.quarterScores[key].left) || !isIntegerScore(candidate.quarterScores[key].top)) {
      throw new Error(`Provider returned invalid ${key} scoring.`);
    }
  }
  const leftTotal = keys.reduce((sum, key) => sum + candidate.quarterScores[key].left, 0);
  const topTotal = keys.reduce((sum, key) => sum + candidate.quarterScores[key].top, 0);
  if (candidate.state !== 'pre' && (leftTotal !== candidate.leftScore || topTotal !== candidate.topScore)) {
    throw new Error('Quarter scoring does not match the reported total.');
  }
  const observed = new Date(candidate.sourceObservedAt);
  if (Number.isNaN(observed.getTime())) throw new Error('Provider did not report when the source score was observed.');
  return {
    leftScore: candidate.leftScore,
    topScore: candidate.topScore,
    quarterScores: candidate.quarterScores,
    clock: String(candidate.clock || '').slice(0, 32),
    period: candidate.period,
    state: candidate.state,
    detail: String(candidate.detail || '').slice(0, 160),
    isOvertime: Boolean(candidate.isOvertime),
    sourceObservedAt: observed.toISOString(),
  };
};

export const toClientScore = (snapshot: any, freshness?: string) => snapshot ? ({
  leftScore: snapshot.side_score,
  topScore: snapshot.top_score,
  quarterScores: snapshot.quarter_scores,
  clock: snapshot.clock || '',
  period: snapshot.period,
  state: snapshot.game_state,
  detail: snapshot.detail || '',
  isOvertime: snapshot.period > 4,
  isManual: snapshot.source_mode === 'manual',
  sourceName: snapshot.source_name || (snapshot.source_mode === 'manual' ? 'Organizer' : 'Automatic beta'),
  sourceUrl: snapshot.source_url || undefined,
  sourceObservedAt: snapshot.source_observed_at,
  retrievedAt: snapshot.retrieved_at,
  staleAfter: snapshot.stale_after,
  freshness: freshness || (new Date(snapshot.stale_after).getTime() > Date.now() ? 'fresh' : 'stale'),
}) : null;

const fetchGroundedScore = async (env: Env, contest: any) => {
  if (!env.GEMINI_API_KEY) throw new Error('Automatic score provider is not configured.');
  const model = env.SCORE_MODEL || 'gemini-2.5-flash';
  const prompt = `Find the current NFL game score for ${contest.side_team_name || contest.side_team_abbr} versus ${contest.top_team_name || contest.top_team_abbr}, scheduled ${contest.game_starts_at || 'date not supplied'}.
Use Google Search. Return only JSON with:
{"leftScore":0,"topScore":0,"quarterScores":{"Q1":{"left":0,"top":0},"Q2":{"left":0,"top":0},"Q3":{"left":0,"top":0},"Q4":{"left":0,"top":0},"OT":{"left":0,"top":0}},"clock":"","period":0,"state":"pre","detail":"","isOvertime":false,"sourceObservedAt":"ISO-8601 timestamp"}
left means ${contest.side_team_name || contest.side_team_abbr}; top means ${contest.top_team_name || contest.top_team_abbr}. Quarter scores must be points scored within each quarter, and must add to the totals. If the matchup cannot be confirmed, do not guess.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0 },
    }),
  });
  const raw = await response.json() as any;
  if (!response.ok) throw new Error(raw?.error?.message || 'Automatic score request failed.');
  const candidate = raw?.candidates?.[0];
  const text = candidate?.content?.parts?.map((part: any) => part.text || '').join('').trim();
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const source = chunks.map((chunk: any) => chunk.web).find((web: any) => web?.uri && web?.title);
  if (!text || !source) throw new Error('Automatic score response was not grounded to a named source.');
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return { score: validateScore(JSON.parse(cleaned)), source, raw };
};

export const onRequestGet: PagesFunction = async ({ request, env, params, waitUntil }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server configuration is incomplete.' }, 503);
  const ref = String(params.id || '').toUpperCase();
  if (!uuidPattern.test(ref) && !sharePattern.test(ref)) return json({ error: 'Invalid board reference.' }, 404);
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ownerId: string | null = null;
  if (uuidPattern.test(ref)) {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in before refreshing an organizer board.' }, 401);
    const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await auth.auth.getUser(token);
    ownerId = data.user?.id || null;
    if (!ownerId) return json({ error: 'Your session has expired.' }, 401);
  }
  let contestQuery = admin
    .from('contests')
    .select('id, owner_id, status, game_starts_at, side_team_name, side_team_abbr, top_team_name, top_team_abbr');
  if (ownerId) contestQuery = contestQuery.eq('owner_id', ownerId);
  const { data: contest, error: contestError } = uuidPattern.test(ref)
    ? await contestQuery.eq('id', ref).maybeSingle()
    : await contestQuery.eq('share_code', ref).in('status', ['published', 'live', 'final', 'archived']).maybeSingle();
  if (contestError) return json({ error: contestError.message }, 500);
  if (!contest) return json({ error: 'Board not found or not published.' }, 404);

  const { data: state } = await admin
    .from('contest_score_state')
    .select('scoring_mode, current_snapshot_id')
    .eq('contest_id', contest.id)
    .maybeSingle();
  const { data: current } = state?.current_snapshot_id
    ? await admin.from('score_snapshots').select('*').eq('id', state.current_snapshot_id).maybeSingle()
    : { data: null };

  const isFresh = current && new Date(current.stale_after).getTime() > Date.now();
  if (current && (isFresh || current.game_state === 'post' || state?.scoring_mode === 'manual')) {
    const winnerHistory = await resolveMilestonesAndNotify(
      admin,
      env,
      contest.id,
      current,
      { sendNotifications: false },
    ) || [];
    const resolutionWork = resolveMilestonesAndNotify(admin, env, contest.id, current);
    if (waitUntil) waitUntil(resolutionWork);
    else await resolutionWork;
    return json({ score: toClientScore(current), winnerHistory, refreshAttempted: false });
  }

  const leaseToken = crypto.randomUUID();
  const { data: acquired, error: leaseError } = await admin.rpc('gridone_acquire_score_refresh_lease', {
    p_contest_id: contest.id,
    p_lease_token: leaseToken,
    p_seconds: 45,
  });
  if (leaseError) return json({ error: leaseError.message, score: toClientScore(current, 'offline') }, current ? 200 : 503);
  if (!acquired) {
    return json({
      score: toClientScore(current, 'refreshing'),
      winnerHistory: await readWinnerHistory(admin, contest.id),
      refreshAttempted: false,
    });
  }

  try {
    const provider = await fetchGroundedScore(env, contest);
    const retrievedAt = new Date();
    const staleSeconds = provider.score.state === 'in' ? 120 : provider.score.state === 'post' ? 31_536_000 : 900;
    const { data: inserted, error: insertError } = await admin
      .from('score_snapshots')
      .insert({
        contest_id: contest.id,
        source_mode: 'automatic',
        provider: env.SCORE_MODEL || 'gemini-2.5-flash',
        game_state: provider.score.state,
        period: provider.score.period,
        side_score: provider.score.leftScore,
        top_score: provider.score.topScore,
        quarter_scores: provider.score.quarterScores,
        clock: provider.score.clock,
        detail: provider.score.detail,
        validation_status: 'accepted',
        source_name: provider.source.title,
        source_url: provider.source.uri,
        source_observed_at: provider.score.sourceObservedAt,
        retrieved_at: retrievedAt.toISOString(),
        stale_after: new Date(retrievedAt.getTime() + staleSeconds * 1000).toISOString(),
      })
      .select('*')
      .single();
    if (insertError) throw insertError;
    await admin.from('score_provider_payloads').insert({ snapshot_id: inserted.id, raw_payload: provider.raw });
    const { data: promoted, error: promoteError } = await admin.rpc('gridone_promote_score_snapshot', {
      p_contest_id: contest.id,
      p_snapshot_id: inserted.id,
    });
    if (promoteError) throw promoteError;
    const effective = promoted ? inserted : current;
    let winnerHistory = await readWinnerHistory(admin, contest.id);
    if (promoted) {
      await admin.from('public_board_snapshots').update({
        score: toClientScore(inserted),
        updated_at: new Date().toISOString(),
      }).eq('contest_id', contest.id);
      winnerHistory = await resolveMilestonesAndNotify(
        admin,
        env,
        contest.id,
        inserted,
        { sendNotifications: false },
      ) || [];
      const resolutionWork = resolveMilestonesAndNotify(admin, env, contest.id, inserted);
      if (waitUntil) waitUntil(resolutionWork);
      else await resolutionWork;
    }
    return json({ score: toClientScore(effective), winnerHistory, refreshAttempted: true });
  } catch (error: any) {
    if (current) return json({
      score: toClientScore(current, 'stale'),
      winnerHistory: await readWinnerHistory(admin, contest.id),
      refreshAttempted: true,
      warning: error.message,
    });
    return json({ error: error?.message || 'Automatic score is unavailable.' }, 503);
  } finally {
    await admin.rpc('gridone_release_score_refresh_lease', {
      p_contest_id: contest.id,
      p_lease_token: leaseToken,
    });
  }
};
