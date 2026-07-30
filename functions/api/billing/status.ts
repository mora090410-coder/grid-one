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

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let order: any = null;
  if (orderId) {
    const { data, error } = await admin
      .from('checkout_orders')
      .select('id, contest_id, season_year, status, paid_at, refundable_at, terminal_reason, amount_refunded_cents')
      .eq('id', orderId)
      .eq('owner_id', authData.user.id)
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data) return Response.json({ error: 'Checkout order not found.' }, { status: 404 });
    order = data;
  }
  const seasonYear = Number(order?.season_year || env.GRIDONE_SEASON || 2026);
  const { data: entitlement, error: entitlementError } = await admin
    .from('season_entitlements')
    .select('id, status, tier, boards_allowance, organization_display_name')
    .eq('owner_id', authData.user.id)
    .eq('season_year', seasonYear)
    .maybeSingle();
  if (entitlementError) {
    return Response.json({ error: entitlementError.message }, { status: 500 });
  }
  let used = 0;
  if (entitlement?.id) {
    const { count, error: countError } = await admin
      .from('board_activations')
      .select('id', { count: 'exact', head: true })
      .eq('entitlement_id', entitlement.id);
    if (countError) return Response.json({ error: countError.message }, { status: 500 });
    used = Number(count || 0);
  }
  const tier = entitlement?.tier || 'free';
  const allowance = Number(entitlement?.boards_allowance || 1);
  return Response.json({
    tier,
    allowance,
    used,
    remaining: Math.max(0, allowance - used),
    seasonYear,
    organizationDisplayName: entitlement?.organization_display_name || null,
    entitlementStatus: entitlement?.status || 'active',
    ...(order ? {
      orderStatus: order.status,
      paymentConfirmed: order.status === 'paid',
      contestId: order.contest_id,
      paidAt: order.paid_at,
      refundable: Boolean(order.refundable_at),
      terminalReason: order.terminal_reason,
      amountRefundedCents: Number(order.amount_refunded_cents || 0),
    } : {}),
  });
};
