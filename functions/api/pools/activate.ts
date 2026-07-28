import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Activation is not configured.' }, { status: 503 });
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Sign in before activating a board.' }, { status: 401 });
  const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await auth.auth.getUser(token);
  if (!authData.user) return Response.json({ error: 'Your session has expired.' }, { status: 401 });
  const { contestId } = await request.json() as { contestId?: string };
  if (!contestId) return Response.json({ error: 'Choose a board to activate.' }, { status: 400 });

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc('gridone_activate_board', {
    p_contest_id: contestId,
    p_owner_id: authData.user.id,
    p_season_year: 2026,
  });
  if (error) {
    const status = /owned/i.test(error.message) ? 403 : 500;
    return Response.json({ error: error.message }, { status });
  }
  const result = data?.[0];
  if (!result?.activated) {
    return Response.json({ needsPayment: true, used: result?.used || 0, allowance: result?.allowance || 0 }, { status: 402 });
  }
  return Response.json({ activated: true, used: result.used, allowance: result.allowance });
};
