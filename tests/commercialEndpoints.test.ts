import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as activateBoard } from '../functions/api/pools/activate';
import { onRequestPost as createCheckout } from '../functions/api/stripe/create-checkout-session';
import { onRequestGet as billingStatus } from '../functions/api/billing/status';
import { onRequestPost as stripeWebhook } from '../functions/api/stripe/webhook';

const mocks = vi.hoisted(() => {
  const clients: any[] = [];
  const stripeInstances: any[] = [];
  const createClient = vi.fn(() => {
    const client = clients.shift();
    if (!client) throw new Error('No scripted Supabase client remains.');
    return client;
  });
  const Stripe = vi.fn(function StripeMock() {
    const instance = stripeInstances.shift();
    if (!instance) throw new Error('No scripted Stripe instance remains.');
    return instance;
  });
  (Stripe as any).createFetchHttpClient = vi.fn(() => ({}));
  return { clients, stripeInstances, createClient, Stripe };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('stripe', () => ({
  default: mocks.Stripe,
}));

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  STRIPE_SECRET_KEY: 'stripe-secret',
  STRIPE_WEBHOOK_SECRET: 'webhook-secret',
  STRIPE_2026_PRICE_ID: 'price_2026',
  PUBLIC_SITE_URL: 'https://www.getgridone.com',
};

const jsonRequest = (
  url: string,
  body: Record<string, unknown>,
  token = 'access-token',
) => new Request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

const authClient = (user: { id: string } | null = { id: 'user-1' }) => ({
  auth: {
    getUser: vi.fn(async () => ({ data: { user } })),
  },
});

/**
 * Minimal Supabase query double. Each terminal call consumes one scripted
 * result, in the same order the endpoint performs its table reads/writes.
 */
const adminClient = (
  results: Array<{ data?: any; error?: any }> = [],
  rpcResult: { data?: any; error?: any } = { data: null, error: null },
) => {
  const terminal = () => Promise.resolve(results.shift() || { data: null, error: null });
  const query = (): any => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      update: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      maybeSingle: vi.fn(terminal),
      single: vi.fn(terminal),
      then: (resolve: any, reject: any) => terminal().then(resolve, reject),
    };
    return chain;
  };
  return {
    from: vi.fn(() => query()),
    rpc: vi.fn(async (..._args: any[]) => rpcResult),
  };
};

const stripeInstance = (overrides: Record<string, any> = {}) => ({
  prices: {
    retrieve: vi.fn(async () => ({
      id: 'price_2026',
      active: true,
      type: 'one_time',
      unit_amount: 499,
      currency: 'usd',
    })),
  },
  checkout: {
    sessions: {
      retrieve: vi.fn(),
      create: vi.fn(),
      listLineItems: vi.fn(),
    },
  },
  webhooks: {
    constructEventAsync: vi.fn(),
  },
  ...overrides,
});

const completedEvent = {
  id: 'evt_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_1',
      payment_status: 'paid',
      client_reference_id: 'order-1',
      metadata: { order_id: 'order-1' },
      payment_intent: 'pi_1',
      customer: 'cus_1',
    },
  },
};

beforeEach(() => {
  mocks.clients.length = 0;
  mocks.stripeInstances.length = 0;
  vi.clearAllMocks();
});

describe.sequential('board activation endpoint', () => {
  it('requires authentication', async () => {
    const response = await activateBoard({
      request: jsonRequest('https://example.test/api/pools/activate', { contestId: 'board-1' }, ''),
      env,
    });
    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects a board not owned by the authenticated user', async () => {
    mocks.clients.push(
      authClient(),
      adminClient([], { data: null, error: { message: 'Contest is not owned by this user.' } }),
    );
    const response = await activateBoard({
      request: jsonRequest('https://example.test/api/pools/activate', { contestId: 'board-2' }),
      env,
    });
    expect(response.status).toBe(403);
  });

  it('reports that payment is needed when no allowance remains', async () => {
    mocks.clients.push(
      authClient(),
      adminClient([], { data: [{ activated: false, used: 20, allowance: 20 }], error: null }),
    );
    const response = await activateBoard({
      request: jsonRequest('https://example.test/api/pools/activate', { contestId: 'board-1' }),
      env,
    });
    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      needsPayment: true,
      used: 20,
      allowance: 20,
    });
  });

  it('activates an owned board within the season allowance', async () => {
    const admin = adminClient([], {
      data: [{ activated: true, used: 3, allowance: 20 }],
      error: null,
    });
    mocks.clients.push(authClient(), admin);
    const response = await activateBoard({
      request: jsonRequest('https://example.test/api/pools/activate', { contestId: 'board-1' }),
      env,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      activated: true,
      used: 3,
      allowance: 20,
    });
    expect(admin.rpc).toHaveBeenCalledWith('gridone_activate_board', {
      p_contest_id: 'board-1',
      p_owner_id: 'user-1',
      p_season_year: 2026,
    });
  });
});

describe.sequential('checkout session endpoint', () => {
  it('requires authentication', async () => {
    const response = await createCheckout({
      request: jsonRequest('https://example.test/api/stripe/create-checkout-session', { contestId: 'board-1' }, ''),
      env,
    });
    expect(response.status).toBe(401);
  });

  it('does not create checkout for a board owned by someone else', async () => {
    mocks.clients.push(authClient(), adminClient([{ data: null, error: null }]));
    const response = await createCheckout({
      request: jsonRequest('https://example.test/api/stripe/create-checkout-session', { contestId: 'board-2' }),
      env,
    });
    expect(response.status).toBe(403);
    expect(mocks.Stripe).not.toHaveBeenCalled();
  });

  it('uses an existing entitlement instead of charging again', async () => {
    const admin = adminClient([
      { data: { id: 'board-1', owner_id: 'user-1', season_year: 2026 }, error: null },
      { data: { id: 'entitlement-1' }, error: null },
    ], {
      data: [{ activated: true, used: 2, allowance: 20 }],
      error: null,
    });
    mocks.clients.push(authClient(), admin);
    const response = await createCheckout({
      request: jsonRequest('https://example.test/api/stripe/create-checkout-session', { contestId: 'board-1' }),
      env,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      alreadyEntitled: true,
      activated: true,
    });
    expect(mocks.Stripe).not.toHaveBeenCalled();
  });

  it('refuses checkout when the configured Stripe price is not exactly $4.99 USD', async () => {
    mocks.clients.push(
      authClient(),
      adminClient([
        { data: { id: 'board-1', owner_id: 'user-1', season_year: 2026 }, error: null },
        { data: null, error: null },
      ]),
    );
    const stripe = stripeInstance();
    stripe.prices.retrieve.mockResolvedValue({
      id: 'price_2026',
      active: true,
      type: 'one_time',
      unit_amount: 999,
      currency: 'usd',
    });
    mocks.stripeInstances.push(stripe);

    const response = await createCheckout({
      request: jsonRequest('https://example.test/api/stripe/create-checkout-session', { contestId: 'board-1' }),
      env,
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('$4.99') });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});

describe.sequential('billing status endpoint', () => {
  const statusRequest = () => new Request(
    'https://example.test/api/billing/status?order=order-1',
    { headers: { Authorization: 'Bearer access-token' } },
  );

  it('does not reveal an order owned by another user', async () => {
    mocks.clients.push(authClient(), adminClient([{ data: null, error: null }]));
    const response = await billingStatus({ request: statusRequest(), env });
    expect(response.status).toBe(404);
  });

  it('reports an activated order', async () => {
    mocks.clients.push(
      authClient(),
      adminClient([
        { data: { id: 'order-1', contest_id: 'board-1', status: 'paid', paid_at: '2026-07-28T12:00:00Z' } },
        { data: { id: 'activation-1' } },
      ]),
    );
    const response = await billingStatus({ request: statusRequest(), env });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      orderStatus: 'paid',
      activated: true,
      contestId: 'board-1',
    });
  });

  it('keeps a paid return in the delayed state until activation exists', async () => {
    mocks.clients.push(
      authClient(),
      adminClient([
        { data: { id: 'order-1', contest_id: 'board-1', status: 'checkout_created', paid_at: null } },
        { data: null },
      ]),
    );
    const response = await billingStatus({ request: statusRequest(), env });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      orderStatus: 'checkout_created',
      activated: false,
      contestId: 'board-1',
    });
  });
});

describe.sequential('Stripe webhook endpoint', () => {
  const webhookRequest = (signature?: string) => new Request(
    'https://example.test/api/stripe/webhook',
    {
      method: 'POST',
      headers: signature ? { 'stripe-signature': signature } : {},
      body: JSON.stringify({ event: 'payload' }),
    },
  );

  it('rejects unsigned requests before constructing an event', async () => {
    const response = await stripeWebhook({ request: webhookRequest(), env });
    expect(response.status).toBe(400);
    expect(mocks.Stripe).not.toHaveBeenCalled();
  });

  it('rejects malformed signed payloads', async () => {
    const stripe = stripeInstance();
    stripe.webhooks.constructEventAsync.mockRejectedValue(new Error('Invalid signature'));
    mocks.stripeInstances.push(stripe);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await stripeWebhook({ request: webhookRequest('bad-signature'), env });
    expect(response.status).toBe(500);
    expect(await response.text()).toContain('Invalid signature');
    consoleError.mockRestore();
  });

  it('rejects a fulfilled session whose price does not match the launch product', async () => {
    const stripe = stripeInstance();
    stripe.webhooks.constructEventAsync.mockResolvedValue(completedEvent);
    stripe.checkout.sessions.listLineItems.mockResolvedValue({
      data: [{ price: { id: 'wrong-price' }, amount_total: 499, currency: 'usd' }],
    });
    mocks.stripeInstances.push(stripe);

    const response = await stripeWebhook({ request: webhookRequest('valid-signature'), env });
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Checkout price mismatch.');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('delegates repeated delivery of the same event to the idempotent fulfillment RPC', async () => {
    const firstStripe = stripeInstance();
    const secondStripe = stripeInstance();
    for (const stripe of [firstStripe, secondStripe]) {
      stripe.webhooks.constructEventAsync.mockResolvedValue(completedEvent);
      stripe.checkout.sessions.listLineItems.mockResolvedValue({
        data: [{ price: { id: 'price_2026' }, amount_total: 499, currency: 'usd' }],
      });
    }
    const firstAdmin = adminClient([], { data: null, error: null });
    const secondAdmin = adminClient([], { data: null, error: null });
    mocks.stripeInstances.push(firstStripe, secondStripe);
    mocks.clients.push(firstAdmin, secondAdmin);

    const first = await stripeWebhook({ request: webhookRequest('valid-signature'), env });
    const replay = await stripeWebhook({ request: webhookRequest('valid-signature'), env });
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(firstAdmin.rpc).toHaveBeenCalledWith('gridone_fulfill_checkout', expect.objectContaining({
      p_event_id: 'evt_1',
      p_order_id: 'order-1',
      p_session_id: 'cs_1',
      p_price_cents: 499,
    }));
    expect(secondAdmin.rpc).toHaveBeenCalledWith(
      'gridone_fulfill_checkout',
      firstAdmin.rpc.mock.calls[0][1],
    );
  });
});
