import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Billing status is not configured.' }, { status: 503 });
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Sign in to check billing status.' }, { status: 401 });
  const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await auth.auth.getUser(token);
  if (!authData.user) return Response.json({ error: 'Your session has expired.' }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get('order');
  if (!orderId) return Response.json({ error: 'Missing checkout order.' }, { status: 400 });

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error } = await admin
    .from('checkout_orders')
    .select('id, contest_id, status, paid_at')
    .eq('id', orderId)
    .eq('owner_id', authData.user.id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!order) return Response.json({ error: 'Checkout order not found.' }, { status: 404 });
  const { data: activation } = await admin
    .from('board_activations')
    .select('id')
    .eq('contest_id', order.contest_id)
    .maybeSingle();
  return Response.json({
    orderStatus: order.status,
    activated: Boolean(activation),
    contestId: order.contest_id,
    paidAt: order.paid_at,
  });
};
