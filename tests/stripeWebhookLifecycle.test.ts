import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as stripeWebhook } from '../functions/api/stripe/webhook';

const mocks = vi.hoisted(() => {
  const stripeInstances: any[] = [];
  const adminClients: any[] = [];
  const Stripe = vi.fn(function StripeMock() {
    const instance = stripeInstances.shift();
    if (!instance) throw new Error('No scripted Stripe instance remains.');
    return instance;
  });
  (Stripe as any).createFetchHttpClient = vi.fn(() => ({}));
  const createClient = vi.fn(() => {
    const client = adminClients.shift();
    if (!client) throw new Error('No scripted Supabase client remains.');
    return client;
  });
  return { stripeInstances, adminClients, Stripe, createClient };
});

vi.mock('stripe', () => ({ default: mocks.Stripe }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  STRIPE_SECRET_KEY: 'stripe-secret',
  STRIPE_WEBHOOK_SECRET: 'webhook-secret',
  STRIPE_GAMEDAY_PRICE_ID: 'price_gameday',
  STRIPE_ORG_PRICE_ID: 'price_org',
};

const webhookRequest = () => new Request('https://example.test/api/stripe/webhook', {
  method: 'POST',
  headers: { 'stripe-signature': 'valid-signature' },
  body: JSON.stringify({ event: 'fixture' }),
});

const checkoutEvent = (
  type: string,
  paymentStatus: 'paid' | 'unpaid' = 'paid',
  eventId = `evt_${type.replaceAll('.', '_')}`,
) => ({
  id: eventId,
  type,
  data: {
    object: {
      id: 'cs_1',
      payment_status: paymentStatus,
      client_reference_id: 'order-1',
      metadata: { order_id: 'order-1', tier: 'gameday' },
      payment_intent: 'pi_1',
      customer: 'cus_1',
    },
  },
});

const stripeInstance = (event: any) => ({
  webhooks: {
    constructEventAsync: vi.fn(async () => event),
  },
  checkout: {
    sessions: {
      listLineItems: vi.fn(async () => ({
        data: [{ price: { id: 'price_gameday' }, amount_total: 999, currency: 'usd' }],
      })),
      retrieve: vi.fn(),
      expire: vi.fn(),
    },
  },
});

const adminClient = (results: Array<{ data?: any; error?: any }> = []) => ({
  rpc: vi.fn(async () => results.shift() || { data: null, error: null }),
  from: vi.fn(() => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return chain;
  }),
});

beforeEach(() => {
  mocks.stripeInstances.length = 0;
  mocks.adminClients.length = 0;
  vi.clearAllMocks();
});

describe.sequential('Stripe Checkout lifecycle webhook', () => {
  it('records completed-but-unpaid checkout as awaiting payment and returns 200', async () => {
    const event = checkoutEvent('checkout.session.completed', 'unpaid');
    const stripe = stripeInstance(event);
    const admin = adminClient();
    mocks.stripeInstances.push(stripe);
    mocks.adminClients.push(admin);

    const response = await stripeWebhook({ request: webhookRequest(), env });

    expect(response.status).toBe(200);
    expect(stripe.checkout.sessions.listLineItems).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith('gridone_record_checkout_session_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_order_id: 'order-1',
      p_session_id: 'cs_1',
      p_status: 'awaiting_payment',
      p_reason: 'Checkout completed while payment is still processing.',
    });
  });

  it('fulfills async payment success through the same verified path', async () => {
    const event = checkoutEvent('checkout.session.async_payment_succeeded');
    const stripe = stripeInstance(event);
    const admin = adminClient([{ data: [{ outcome: 'fulfilled', owner_id: 'owner-1', season_year: 2026 }], error: null }]);
    mocks.stripeInstances.push(stripe);
    mocks.adminClients.push(admin);

    const response = await stripeWebhook({ request: webhookRequest(), env });

    expect(response.status).toBe(200);
    expect(stripe.checkout.sessions.listLineItems).toHaveBeenCalledWith('cs_1', { limit: 10 });
    expect(admin.rpc).toHaveBeenCalledWith('gridone_fulfill_checkout_v2', expect.objectContaining({
      p_event_id: event.id,
      p_event_type: event.type,
      p_order_id: 'order-1',
      p_session_id: 'cs_1',
      p_payment_intent_id: 'pi_1',
    }));
  });

  it('expires and closes every other owner-season checkout after fulfillment', async () => {
    const event = checkoutEvent('checkout.session.completed');
    const stripe = stripeInstance(event);
    stripe.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_stale', status: 'open' });
    stripe.checkout.sessions.expire.mockResolvedValue({ id: 'cs_stale', status: 'expired' });

    let fromCall = 0;
    const admin = {
      rpc: vi.fn(async () => ({
        data: [{ outcome: 'fulfilled', owner_id: 'owner-1', season_year: 2026 }],
        error: null,
      })),
      from: vi.fn(() => {
        const result = fromCall++ === 0
          ? { data: [{ id: 'order-stale', stripe_checkout_session_id: 'cs_stale' }], error: null }
          : { data: null, error: null };
        const chain: any = {
          select: vi.fn(() => chain),
          update: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          order: vi.fn(() => chain),
          then: (resolve: any) => Promise.resolve(result).then(resolve),
        };
        return chain;
      }),
    };
    mocks.stripeInstances.push(stripe);
    mocks.adminClients.push(admin);

    const response = await stripeWebhook({ request: webhookRequest(), env });

    expect(response.status).toBe(200);
    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_stale');
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_stale');
    expect(admin.from).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['checkout.session.async_payment_failed', 'failed', 'Stripe reported that the delayed payment failed.'],
    ['checkout.session.expired', 'expired', 'Stripe Checkout expired before payment completed.'],
  ])('records %s as a terminal order state', async (eventType, status, reason) => {
    const event = checkoutEvent(eventType);
    const stripe = stripeInstance(event);
    const admin = adminClient();
    mocks.stripeInstances.push(stripe);
    mocks.adminClients.push(admin);

    const response = await stripeWebhook({ request: webhookRequest(), env });

    expect(response.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith('gridone_record_checkout_session_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_order_id: 'order-1',
      p_session_id: 'cs_1',
      p_status: status,
      p_reason: reason,
    });
  });

  it('records cumulative partial refund state without treating the event type as a full refund', async () => {
    const event = {
      id: 'evt_partial_refund',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_1',
          payment_intent: 'pi_1',
          amount: 499,
          amount_refunded: 200,
          refunded: false,
        },
      },
    };
    const stripe = stripeInstance(event);
    const admin = adminClient();
    mocks.stripeInstances.push(stripe);
    mocks.adminClients.push(admin);

    const response = await stripeWebhook({ request: webhookRequest(), env });

    expect(response.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith('gridone_apply_entitlement_payment_event', expect.objectContaining({
      p_event_id: 'evt_partial_refund',
      p_event_type: 'charge.refunded',
      p_payment_intent_id: 'pi_1',
      p_charge_id: 'ch_1',
      p_amount: 499,
      p_amount_refunded: 200,
      p_refunded: false,
    }));
  });

  it.each([
    ['charge.dispute.created', 'needs_response'],
    ['charge.dispute.closed', 'won'],
    ['charge.dispute.closed', 'lost'],
  ])('routes %s with dispute status %s to the entitlement state RPC', async (eventType, disputeStatus) => {
    const event = {
      id: `evt_${eventType.replaceAll('.', '_')}_${disputeStatus}`,
      type: eventType,
      data: {
        object: {
          id: `dp_${disputeStatus}`,
          charge: 'ch_1',
          payment_intent: 'pi_1',
          amount: 499,
          currency: 'usd',
          reason: 'fraudulent',
          status: disputeStatus,
        },
      },
    };
    const stripe = stripeInstance(event);
    const admin = adminClient();
    mocks.stripeInstances.push(stripe);
    mocks.adminClients.push(admin);

    const response = await stripeWebhook({ request: webhookRequest(), env });

    expect(response.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith('gridone_apply_entitlement_payment_event', expect.objectContaining({
      p_event_id: event.id,
      p_event_type: eventType,
      p_payment_intent_id: 'pi_1',
      p_charge_id: 'ch_1',
      p_dispute_id: `dp_${disputeStatus}`,
      p_dispute_status: disputeStatus,
      p_reason: 'fraudulent',
    }));
  });
});
