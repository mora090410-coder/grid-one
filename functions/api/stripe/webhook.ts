import Stripe from 'stripe';
import { configuredTierForPrice } from '../../_lib/pricingTiers';
import { adminClient, type PagesFunction } from '../../_lib/http';

const text = (body: string, status = 200) => new Response(body, { status });

const stripeId = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id?: unknown }).id || '');
  return '';
};

const checkoutOrderId = (session: Stripe.Checkout.Session) => {
  const orderId = session.metadata?.order_id;
  return orderId && session.client_reference_id === orderId ? orderId : null;
};

const expireSiblingSessions = async (
  admin: any,
  stripe: Stripe,
  ownerId: string,
  seasonYear: number,
  fulfilledSessionId: string,
) => {
  const { data: siblingOrders, error } = await admin
    .from('checkout_orders')
    .select('id, stripe_checkout_session_id')
    .eq('owner_id', ownerId)
    .eq('season_year', seasonYear)
    .in('status', ['pending', 'checkout_created', 'awaiting_payment'])
    .order('created_at', { ascending: false });
  if (error) throw error;

  for (const order of siblingOrders || []) {
    const sessionId = String(order.stripe_checkout_session_id || '');
    if (!sessionId || sessionId === fulfilledSessionId) continue;
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === 'open') await stripe.checkout.sessions.expire(sessionId);
      const { error: expireError } = await admin.from('checkout_orders').update({
        status: 'expired',
        terminal_at: new Date().toISOString(),
        terminal_reason: 'Another checkout completed for this owner and season.',
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      if (expireError) throw expireError;
    } catch (error) {
      console.warn('Unable to expire a sibling Stripe Checkout Session.', {
        orderId: order.id,
        reason: error instanceof Error ? error.message : 'Unknown Stripe error',
      });
      throw error;
    }
  }
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return text('Webhook is not configured.', 503);
  }
  const signature = request.headers.get('stripe-signature');
  if (!signature) return text('Missing signature.', 400);

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error('Stripe webhook signature validation failed.', error);
    return text(error instanceof Error ? error.message : 'Invalid webhook payload.', 400);
  }

  try {
    const checkoutTypes = new Set([
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'checkout.session.expired',
    ]);
    const entitlementTypes = new Set([
      'charge.refunded',
      'charge.dispute.created',
      'charge.dispute.closed',
    ]);
    if (!checkoutTypes.has(event.type) && !entitlementTypes.has(event.type)) {
      return text('Ignored unhandled event.');
    }

    if (entitlementTypes.has(event.type)) {
      const object = event.data.object as any;
      const isDispute = event.type.startsWith('charge.dispute.');
      const admin = adminClient(env);
      const { error } = await admin.rpc('gridone_apply_entitlement_payment_event', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_payment_intent_id: stripeId(object.payment_intent) || null,
        p_charge_id: isDispute ? stripeId(object.charge) || null : stripeId(object.id) || null,
        p_dispute_id: isDispute ? stripeId(object.id) || null : null,
        p_dispute_status: isDispute ? String(object.status || '') || null : null,
        p_reason: String(object.reason || '') || null,
        p_amount: Number(object.amount || 0),
        p_amount_refunded: event.type === 'charge.refunded' ? Number(object.amount_refunded || 0) : 0,
        p_refunded: event.type === 'charge.refunded' ? Boolean(object.refunded) : false,
      });
      if (error) throw error;
      return text('Entitlement payment event recorded.');
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = checkoutOrderId(session);
    if (!orderId) return text('Ignored invalid order metadata.');

    if (event.type === 'checkout.session.completed' && session.payment_status === 'unpaid') {
      const admin = adminClient(env);
      const { error } = await admin.rpc('gridone_record_checkout_session_event', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_order_id: orderId,
        p_session_id: session.id,
        p_status: 'awaiting_payment',
        p_reason: 'Checkout completed while payment is still processing.',
      });
      if (error) throw error;
      return text('Payment is processing.');
    }

    if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
      const admin = adminClient(env);
      const failed = event.type === 'checkout.session.async_payment_failed';
      const { error } = await admin.rpc('gridone_record_checkout_session_event', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_order_id: orderId,
        p_session_id: session.id,
        p_status: failed ? 'failed' : 'expired',
        p_reason: failed
          ? 'Stripe reported that the delayed payment failed.'
          : 'Stripe Checkout expired before payment completed.',
      });
      if (error) throw error;
      return text(failed ? 'Payment failure recorded.' : 'Checkout expiry recorded.');
    }

    if (session.payment_status !== 'paid') {
      return text('Ignored checkout without completed payment.');
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    if (lineItems.data.length !== 1) {
      // A paid session that fulfills nothing needs a human; make it visible in logs.
      console.error('Paid checkout ignored: unexpected line items.', {
        eventId: event.id, sessionId: session.id, orderId, lineItemCount: lineItems.data.length,
      });
      return text('Ignored unexpected checkout line items.');
    }
    const line = lineItems.data[0];
    let priceId = stripeId(line.price);
    let verifiedV3 = false;
    let admin: ReturnType<typeof adminClient> | undefined;
    if (session.metadata?.billing_version === '3') {
      admin = adminClient(env);
      const { data: order, error: orderError } = await admin.from('checkout_orders')
        .select('id, owner_id, contest_id, season_year, target_tier, price_id, price_cents, currency, credit_cents, credit_source_order_id, billing_version, stripe_checkout_session_id')
        .eq('id', orderId).maybeSingle();
      if (orderError) throw orderError;
      const definition = order && configuredTierForPrice(order.price_id, env);
      if (!order || !definition || order.billing_version !== 3
        || session.metadata.owner_id !== order.owner_id
        || session.metadata.contest_id !== order.contest_id
        || session.metadata.season !== String(order.season_year)
        || session.metadata.tier !== order.target_tier
        || order.target_tier !== definition.tier
        || (order.stripe_checkout_session_id && order.stripe_checkout_session_id !== session.id)) {
        return text('Ignored checkout order mismatch.');
      }
      const credited = order.target_tier === 'org' && order.credit_cents === 999 && order.credit_source_order_id;
      const expected = credited ? 6901 : definition.amountCents;
      const canonicalPrice = await stripe.prices.retrieve(definition.priceId);
      const actualPrice = line.price;
      if (order.price_cents !== expected || order.currency !== 'usd'
        || canonicalPrice.unit_amount !== definition.amountCents || canonicalPrice.currency !== 'usd' || canonicalPrice.type !== 'one_time'
        || !actualPrice || actualPrice.type !== 'one_time' || actualPrice.unit_amount !== expected
        || stripeId(actualPrice.product) !== stripeId(canonicalPrice.product)
        || (!credited && actualPrice.id !== definition.priceId)
        || line.quantity !== 1 || line.amount_subtotal !== expected || line.amount_total !== expected || line.currency !== 'usd'
        || session.amount_subtotal !== expected || session.amount_total !== expected || session.currency !== 'usd'
        || (!credited && order.credit_cents !== 0)) {
        return text('Ignored checkout price mismatch.');
      }
      priceId = definition.priceId;
      verifiedV3 = true;
    }
    const configuredTier = configuredTierForPrice(priceId, env);
    if (
      !verifiedV3 && (!configuredTier
      || line.amount_total !== configuredTier.amountCents
      || line.currency !== 'usd'
      || session.metadata?.tier !== configuredTier.tier)
    ) {
      // No existing RPC records a mismatch without changing the order's state,
      // so the paid session is logged for manual review instead.
      console.error('Paid checkout ignored: price mismatch.', {
        eventId: event.id,
        sessionId: session.id,
        orderId,
        priceId,
        amountTotal: line.amount_total,
        currency: line.currency,
        metadataTier: session.metadata?.tier ?? null,
      });
      return text('Ignored checkout price mismatch.');
    }

    admin ??= adminClient(env);
    const { data, error } = await admin.rpc('gridone_fulfill_checkout_v2', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_order_id: orderId,
      p_session_id: session.id,
      p_payment_intent_id: stripeId(session.payment_intent),
      p_customer_id: stripeId(session.customer),
      p_price_id: priceId,
      p_price_cents: line.amount_total,
      p_currency: line.currency,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (result?.owner_id && result?.season_year) {
      await expireSiblingSessions(
        admin,
        stripe,
        String(result.owner_id),
        Number(result.season_year),
        session.id,
      );
    }
    return text(
      result?.outcome === 'duplicate_payment'
        ? 'Duplicate payment recorded for refund review.'
        : 'Fulfilled.',
    );
  } catch (error) {
    console.error('Stripe webhook processing failed.', error);
    return text('Webhook processing failed.', 500);
  }
};
