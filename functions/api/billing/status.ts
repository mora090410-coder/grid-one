import { adminClient, currentSeason, isUuid, maskedError, requireUser, type PagesFunction } from '../../_lib/http';

const STATUS_FAILED = 'Billing status is temporarily unavailable. Please try again.';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Billing status is not configured.' }, { status: 503 });
  const user = await requireUser(request, env, { missing: 'Sign in to check billing status.', expired: 'Your session has expired.' });
  if (user instanceof Response) return user;
  const orderId = new URL(request.url).searchParams.get('order');

  const admin = adminClient(env);
  let order: any = null;
  if (orderId) {
    // A malformed id can name no order; answer before Postgres sees the cast.
    if (!isUuid(orderId)) return Response.json({ error: 'Checkout order not found.' }, { status: 404 });
    const { data, error } = await admin
      .from('checkout_orders')
      .select('id, contest_id, season_year, status, paid_at, refundable_at, terminal_reason, amount_refunded_cents')
      .eq('id', orderId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) return maskedError('Checkout order lookup failed', error, STATUS_FAILED);
    if (!data) return Response.json({ error: 'Checkout order not found.' }, { status: 404 });
    order = data;
  }
  const seasonYear = Number(order?.season_year || currentSeason(env));
  const { data: entitlement, error: entitlementError } = await admin
    .from('season_entitlements')
    .select('id, status, tier, boards_allowance, organization_display_name')
    .eq('owner_id', user.id)
    .eq('season_year', seasonYear)
    .maybeSingle();
  if (entitlementError) return maskedError('Entitlement lookup failed', entitlementError, STATUS_FAILED);
  let used = 0;
  if (entitlement?.id) {
    const { count, error: countError } = await admin
      .from('board_activations')
      .select('id', { count: 'exact', head: true })
      .eq('entitlement_id', entitlement.id);
    if (countError) return maskedError('Board activation count failed', countError, STATUS_FAILED);
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
