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
  STRIPE_GAMEDAY_PRICE_ID: 'price_gameday',
  STRIPE_ORG_PRICE_ID: 'price_org',
  PUBLIC_SITE_URL: 'https://www.getgridone.com',
  PAID_SIGNUP_ENABLED: 'true',
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

type ScriptedResult = {
  data?: any;
  error?: any;
  count?: number | null;
};

const adminClient = (
  results: ScriptedResult[] = [],
  rpcResults: ScriptedResult[] = [],
) => {
  const terminal = () => Promise.resolve(
    results.shift() || { data: null, error: null },
  );
  const query = (): any => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
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
    rpc: vi.fn(async () => (
      rpcResults.shift() || { data: null, error: null }
    )),
  };
};

const stripeInstance = ({
  priceId = 'price_gameday',
  amountCents = 999,
}: {
  priceId?: string;
  amountCents?: number;
} = {}) => ({
  prices: {
    retrieve: vi.fn(async () => ({
      id: priceId,
      active: true,
      type: 'one_time',
      unit_amount: amountCents,
      currency: 'usd',
    })),
  },
  checkout: {
    sessions: {
      retrieve: vi.fn(),
      create: vi.fn(),
      expire: vi.fn(),
      listLineItems: vi.fn(),
    },
  },
  webhooks: {
    constructEventAsync: vi.fn(),
  },
});

const completedEvent = (
  tier: 'gameday' | 'org',
  eventId = `evt_${tier}`,
) => ({
  id: eventId,
  type: 'checkout.session.completed',
  data: {
    object: {
      id: `cs_${tier}`,
      payment_status: 'paid',
      client_reference_id: `order-${tier}`,
      metadata: {
        order_id: `order-${tier}`,
        tier,
      },
      payment_intent: `pi_${tier}`,
      customer: `cus_${tier}`,
    },
  },
});

const checkoutFixture = ({
  tier,
  entitlementTier,
  allowance,
  used,
  organizationName,
}: {
  tier: 'gameday' | 'org';
  entitlementTier: 'free' | 'gameday';
  allowance: 1 | 5;
  used: 1 | 5;
  organizationName?: string;
}) => {
  const priceId = tier === 'org' ? 'price_org' : 'price_gameday';
  const amountCents = tier === 'org' ? 7900 : 999;
  const admin = adminClient([
    {
      data: {
        id: 'board-1',
        owner_id: 'user-1',
        season_year: 2026,
      },
      error: null,
    },
    {
      data: {
        id: 'entitlement-1',
        tier: entitlementTier,
        status: 'active',
        boards_allowance: allowance,
      },
      error: null,
    },
    { count: used, data: null, error: null },
    { data: [], error: null },
  ], [
    {
      data: [{
        order_id: `order-${tier}`,
        order_status: 'pending',
        already_entitled: false,
      }],
      error: null,
    },
    { data: null, error: null },
  ]);
  const stripe = stripeInstance({ priceId, amountCents });
  stripe.checkout.sessions.create.mockResolvedValue({
    id: `cs_${tier}`,
    url: `https://checkout.stripe.test/${tier}`,
  });
  mocks.clients.push(authClient(), admin);
  mocks.stripeInstances.push(stripe);
  return {
    admin,
    stripe,
    request: jsonRequest(
      'https://example.test/api/stripe/create-checkout-session',
      {
        contestId: 'board-1',
        tier,
        ...(organizationName ? { organizationName } : {}),
      },
    ),
  };
};

beforeEach(() => {
  mocks.clients.length = 0;
  mocks.stripeInstances.length = 0;
  vi.clearAllMocks();
});

describe.sequential('retired activation endpoint', () => {
  it('returns 410 without touching authentication or the database', async () => {
    const response = await activateBoard({
      request: jsonRequest(
        'https://example.test/api/pools/activate',
        { contestId: 'board-1' },
      ),
      env,
    });

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      code: 'PUBLISH_IS_ALLOWANCE_BOUNDARY',
      error: 'Boards are counted only when they are published. Publish the draft from the organizer view.',
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe.sequential('tiered checkout session endpoint', () => {
  it('creates the exact $9.99 Game Day checkout offered at the free limit', async () => {
    const { admin, stripe, request } = checkoutFixture({
      tier: 'gameday',
      entitlementTier: 'free',
      allowance: 1,
      used: 1,
    });

    const response = await createCheckout({ request, env });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: 'https://checkout.stripe.test/gameday',
      orderId: 'order-gameday',
    });
    expect(stripe.prices.retrieve).toHaveBeenCalledWith('price_gameday');
    expect(admin.rpc).toHaveBeenNthCalledWith(
      1,
      'gridone_claim_checkout_order',
      {
        p_owner_id: 'user-1',
        p_contest_id: 'board-1',
        p_season_year: 2026,
        p_price_id: 'price_gameday',
        p_price_cents: 999,
        p_currency: 'usd',
        p_target_tier: 'gameday',
        p_organization_display_name: null,
      },
    );
    expect(stripe.checkout.sessions.create.mock.calls[0][0]).toMatchObject({
      line_items: [{ price: 'price_gameday', quantity: 1 }],
      metadata: { tier: 'gameday' },
      payment_intent_data: {
        description: 'GridOne Game Day — 2026 season',
        metadata: { tier: 'gameday' },
      },
    });
  });

  it('creates the exact $79 Organization checkout offered at the Game Day limit', async () => {
    const { admin, stripe, request } = checkoutFixture({
      tier: 'org',
      entitlementTier: 'gameday',
      allowance: 5,
      used: 5,
      organizationName: '  Riverside   Ravens Booster Club  ',
    });

    const response = await createCheckout({ request, env });

    expect(response.status).toBe(200);
    expect(stripe.prices.retrieve).toHaveBeenCalledWith('price_org');
    expect(admin.rpc).toHaveBeenNthCalledWith(
      1,
      'gridone_claim_checkout_order',
      expect.objectContaining({
        p_price_id: 'price_org',
        p_price_cents: 7900,
        p_target_tier: 'org',
        p_organization_display_name: 'Riverside Ravens Booster Club',
      }),
    );
    expect(stripe.checkout.sessions.create.mock.calls[0][0]).toMatchObject({
      line_items: [{ price: 'price_org', quantity: 1 }],
      metadata: {
        tier: 'org',
        organization_name: 'Riverside Ravens Booster Club',
      },
      payment_intent_data: {
        description: 'GridOne Organization — Riverside Ravens Booster Club',
        metadata: {
          tier: 'org',
          organization_name: 'Riverside Ravens Booster Club',
        },
      },
    });
  });

  it('rejects a plan other than the one offered by the server', async () => {
    const admin = adminClient([
      {
        data: {
          id: 'board-1',
          owner_id: 'user-1',
          season_year: 2026,
        },
        error: null,
      },
      {
        data: {
          id: 'entitlement-1',
          tier: 'free',
          status: 'active',
          boards_allowance: 1,
        },
        error: null,
      },
      { count: 1, data: null, error: null },
    ]);
    mocks.clients.push(authClient(), admin);

    const response = await createCheckout({
      request: jsonRequest(
        'https://example.test/api/stripe/create-checkout-session',
        {
          contestId: 'board-1',
          tier: 'org',
          organizationName: 'Riverside Ravens',
        },
      ),
      env,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'WRONG_UPGRADE_TIER',
      offeredTier: 'gameday',
    });
    expect(mocks.Stripe).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['gameday', 'price_gameday', 7900],
    ['org', 'price_org', 999],
  ] as const)(
    'rejects %s checkout when Stripe does not return the approved amount',
    async (tier, priceId, amountCents) => {
      const entitlementTier = tier === 'org' ? 'gameday' : 'free';
      const allowance = tier === 'org' ? 5 : 1;
      const used = allowance;
      const admin = adminClient([
        {
          data: {
            id: 'board-1',
            owner_id: 'user-1',
            season_year: 2026,
          },
          error: null,
        },
        {
          data: {
            id: 'entitlement-1',
            tier: entitlementTier,
            status: 'active',
            boards_allowance: allowance,
          },
          error: null,
        },
        { count: used, data: null, error: null },
      ]);
      const stripe = stripeInstance({ priceId, amountCents });
      mocks.clients.push(authClient(), admin);
      mocks.stripeInstances.push(stripe);

      const response = await createCheckout({
        request: jsonRequest(
          'https://example.test/api/stripe/create-checkout-session',
          {
            contestId: 'board-1',
            tier,
            ...(tier === 'org'
              ? { organizationName: 'Riverside Ravens' }
              : {}),
          },
        ),
        env,
      });

      expect(response.status).toBe(503);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(admin.rpc).not.toHaveBeenCalled();
    },
  );

  it('does not reuse an open session created for the other price', async () => {
    const admin = adminClient([
      {
        data: {
          id: 'board-1',
          owner_id: 'user-1',
          season_year: 2026,
        },
        error: null,
      },
      {
        data: {
          id: 'entitlement-1',
          tier: 'free',
          status: 'active',
          boards_allowance: 1,
        },
        error: null,
      },
      { count: 1, data: null, error: null },
      {
        data: [{
          id: 'order-org',
          contest_id: 'board-1',
          status: 'checkout_created',
          price_id: 'price_org',
          stripe_checkout_session_id: 'cs_org_old',
        }],
        error: null,
      },
      { data: null, error: null },
    ], [
      {
        data: [{
          order_id: 'order-gameday-new',
          order_status: 'pending',
          already_entitled: false,
        }],
        error: null,
      },
      { data: null, error: null },
    ]);
    const stripe = stripeInstance();
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_org_old',
      status: 'open',
      url: 'https://checkout.stripe.test/wrong-price',
    });
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_gameday_new',
      url: 'https://checkout.stripe.test/gameday-new',
    });
    mocks.clients.push(authClient(), admin);
    mocks.stripeInstances.push(stripe);

    const response = await createCheckout({
      request: jsonRequest(
        'https://example.test/api/stripe/create-checkout-session',
        { contestId: 'board-1', tier: 'gameday' },
      ),
      env,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: 'https://checkout.stripe.test/gameday-new',
      orderId: 'order-gameday-new',
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });
});

describe.sequential('billing status endpoint', () => {
  it('returns tier, allowance, used count, remaining count, and organization name', async () => {
    mocks.clients.push(
      authClient(),
      adminClient([
        {
          data: {
            id: 'order-1',
            contest_id: 'board-1',
            season_year: 2026,
            status: 'paid',
            paid_at: '2026-07-29T12:00:00Z',
            refundable_at: null,
            terminal_reason: null,
            amount_refunded_cents: 0,
          },
          error: null,
        },
        {
          data: {
            id: 'entitlement-1',
            status: 'active',
            tier: 'org',
            boards_allowance: 50,
            organization_display_name: 'Riverside Ravens Booster Club',
          },
          error: null,
        },
        { count: 7, data: null, error: null },
      ]),
    );

    const response = await billingStatus({
      request: new Request(
        'https://example.test/api/billing/status?order=order-1',
        { headers: { Authorization: 'Bearer access-token' } },
      ),
      env,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      tier: 'org',
      allowance: 50,
      used: 7,
      remaining: 43,
      organizationDisplayName: 'Riverside Ravens Booster Club',
      entitlementStatus: 'active',
      orderStatus: 'paid',
      paymentConfirmed: true,
      contestId: 'board-1',
    });
  });
});

describe.sequential('Stripe webhook price map', () => {
  const webhookRequest = () => new Request(
    'https://example.test/api/stripe/webhook',
    {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-signature' },
      body: JSON.stringify({ event: 'payload' }),
    },
  );

  it.each([
    ['gameday', 'price_gameday', 999],
    ['org', 'price_org', 7900],
  ] as const)(
    'fulfills the exact %s price and metadata combination',
    async (tier, priceId, amountCents) => {
      const event = completedEvent(tier);
      const stripe = stripeInstance({ priceId, amountCents });
      stripe.webhooks.constructEventAsync.mockResolvedValue(event);
      stripe.checkout.sessions.listLineItems.mockResolvedValue({
        data: [{
          price: { id: priceId },
          amount_total: amountCents,
          currency: 'usd',
        }],
      });
      const admin = adminClient([], [{
        data: [{
          outcome: 'fulfilled',
          owner_id: null,
          season_year: 2026,
        }],
        error: null,
      }]);
      mocks.stripeInstances.push(stripe);
      mocks.clients.push(admin);

      const response = await stripeWebhook({
        request: webhookRequest(),
        env,
      });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Fulfilled.');
      expect(admin.rpc).toHaveBeenCalledWith(
        'gridone_fulfill_checkout_v2',
        expect.objectContaining({
          p_event_id: event.id,
          p_order_id: `order-${tier}`,
          p_session_id: `cs_${tier}`,
          p_price_id: priceId,
          p_price_cents: amountCents,
          p_currency: 'usd',
        }),
      );
    },
  );

  it.each([
    ['unknown price', 'gameday', 'price_unknown', 999, 'usd'],
    ['wrong amount', 'gameday', 'price_gameday', 7900, 'usd'],
    ['wrong currency', 'gameday', 'price_gameday', 999, 'cad'],
    ['wrong metadata tier', 'org', 'price_gameday', 999, 'usd'],
  ] as const)(
    'acknowledges but does not fulfill a signed checkout with %s',
    async (_label, metadataTier, priceId, amountTotal, currency) => {
      const event = completedEvent(metadataTier);
      const stripe = stripeInstance();
      stripe.webhooks.constructEventAsync.mockResolvedValue(event);
      stripe.checkout.sessions.listLineItems.mockResolvedValue({
        data: [{
          price: { id: priceId },
          amount_total: amountTotal,
          currency,
        }],
      });
      mocks.stripeInstances.push(stripe);

      const response = await stripeWebhook({
        request: webhookRequest(),
        env,
      });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Ignored checkout price mismatch.');
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );
});
