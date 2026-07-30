import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { configuredTierForPrice } from '../../_lib/pricingTiers';

type PagesFunction = (context: any) => Promise<Response> | Response;

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
      const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
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
      const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
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
      const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
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
    if (lineItems.data.length !== 1) return text('Ignored unexpected checkout line items.');
    const line = lineItems.data[0];
    const priceId = stripeId(line.price);
    const configuredTier = configuredTierForPrice(priceId, env);
    if (
      !configuredTier
      || line.amount_total !== configuredTier.amountCents
      || line.currency !== 'usd'
      || session.metadata?.tier !== configuredTier.tier
    ) {
      return text('Ignored checkout price mismatch.');
    }

    const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
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
