import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

interface Env {
  PUBLIC_SITE_URL?: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8788',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://getgridone.com',
  'https://www.getgridone.com',
];

function getCorsHeaders(request: Request, extraOrigin?: string): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = [...DEFAULT_ALLOWED_ORIGINS];
  if (extraOrigin) allowed.push(extraOrigin);
  const isAllowed = allowed.some(a => origin.startsWith(a)) || origin === '';
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin || '*' : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(context: any, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' },
  });
}

export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL) });
};

/**
 * Season-pass activation: unlocks a board without a new payment when the
 * organizer's entitlement allowance (from a prior $14.99 purchase) still has
 * room. Returns 402 when payment is required so the client can fall back to
 * Stripe checkout.
 */
export const onRequestPost: PagesFunction = async (context) => {
  const env = context.env as Env;
  const authHeader = context.request.headers.get('Authorization');
  const bearer = authHeader?.replace('Bearer ', '');
  if (!bearer) {
    return jsonResponse(context, 401, { error: 'Unauthorized: Missing Token' });
  }

  let contestId: string | undefined;
  try {
    ({ contestId } = await context.request.json() as { contestId?: string });
  } catch {
    // fall through to the missing-contestId error
  }
  if (!contestId) {
    return jsonResponse(context, 400, { error: 'Missing contestId' });
  }

  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const { data: authData } = await supabase.auth.getUser(bearer);
  const userId = authData.user?.id;
  if (!userId) {
    return jsonResponse(context, 401, { error: 'Unauthorized: Invalid Token' });
  }

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

  const { data: contest, error: contestError } = await admin
    .from('contests')
    .select('id, owner_id, is_activated')
    .eq('id', contestId)
    .single();

  if (contestError || !contest) {
    return jsonResponse(context, 404, { error: 'Pool not found' });
  }
  if (contest.owner_id !== userId) {
    return jsonResponse(context, 403, { error: 'Only the board owner can activate it' });
  }
  if (contest.is_activated) {
    return jsonResponse(context, 200, { activated: true, alreadyActivated: true });
  }

  const [{ data: entitlements, error: entError }, { count: usedCount, error: usedError }] = await Promise.all([
    admin.from('entitlements').select('boards_allowance').eq('owner_id', userId),
    admin.from('contests').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('is_activated', true),
  ]);

  if (entError || usedError) {
    console.error('Entitlement lookup failed:', entError || usedError);
    return jsonResponse(context, 500, { error: 'Entitlement lookup failed' });
  }

  const allowance = (entitlements || []).reduce((sum, e) => sum + (e.boards_allowance || 0), 0);
  const used = usedCount || 0;

  if (used >= allowance) {
    return jsonResponse(context, 402, { needsPayment: true, allowance, used });
  }

  const { error: activateError } = await admin
    .from('contests')
    .update({
      is_activated: true,
      activated_at: new Date().toISOString(),
      activation_price_id: 'entitlement',
    })
    .eq('id', contestId);

  if (activateError) {
    console.error('Activation failed:', activateError);
    return jsonResponse(context, 500, { error: 'Activation failed' });
  }

  return jsonResponse(context, 200, { activated: true, allowance, used: used + 1 });
};
