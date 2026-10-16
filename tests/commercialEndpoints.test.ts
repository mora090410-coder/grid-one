import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as activateBoard } from '../functions/api/pools/activate';
import { onRequestPost as createCheckout } from '../functions/api/stripe/create-checkout-session';
import { onRequestGet as billingStatus } from '../functions/api/billing/status';
import { onRequestPost as stripeWebhook } from '../functions/api/stripe/webhook';

const mocks = vi.hoisted(() => {
  const clients: any[] = []; const stripeInstances: any[] = [];
  const createClient = vi.fn(() => { const c = clients.shift(); if (!c) throw new Error('No scripted Supabase client'); return c; });
  const Stripe = vi.fn(function () { const s = stripeInstances.shift(); if (!s) throw new Error('No scripted Stripe instance'); return s; });
  (Stripe as any).createFetchHttpClient = vi.fn(() => ({}));
  return { clients, stripeInstances, createClient, Stripe };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('stripe', () => ({ default: mocks.Stripe }));
const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key', STRIPE_SECRET_KEY: 'stripe-secret', STRIPE_WEBHOOK_SECRET: 'webhook-secret',
  STRIPE_GAMEDAY_PRICE_ID: 'price_gameday', STRIPE_ORG_PRICE_ID: 'price_org', PUBLIC_SITE_URL: 'https://www.getgridone.com', PAID_SIGNUP_ENABLED: 'true',
};
const request = (body: object) => new Request('https://example.test/api/stripe/create-checkout-session', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer access-token' }, body: JSON.stringify(body),
});
const adminClient = (results: any[] = [], rpcResults: any[] = []) => ({
  from: vi.fn(() => {
    const terminal = () => Promise.resolve(results.shift() || { data: null, error: null });
    const chain: any = { select: vi.fn(() => chain), eq: vi.fn(() => chain), in: vi.fn(() => chain), order: vi.fn(() => chain),
      limit: vi.fn(() => chain), update: vi.fn(() => chain), maybeSingle: vi.fn(terminal),
      then: (accept: any, reject: any) => terminal().then(accept, reject) };
    return chain;
  }),
  rpc: vi.fn(async (_name: string, _args: any) => rpcResults.shift() || { data: null, error: null }),
});
const stripeInstance = (tier = 'gameday', amount = tier === 'org' ? 7900 : 999) => ({
  prices: { retrieve: vi.fn(async () => ({ id: `price_${tier}`, active: true, type: 'one_time', unit_amount: amount, currency: 'usd', product: `prod_${tier}` })) },
  checkout: { sessions: { retrieve: vi.fn(), create: vi.fn(async (_params: any, _options?: any) => ({ id: `cs_${tier}`, url: `https://checkout.stripe.test/${tier}`, expires_at: 1790000000 })), expire: vi.fn(), listLineItems: vi.fn() } },
  webhooks: { constructEventAsync: vi.fn() },
});
const checkoutFixture = ({ tier = 'org', entitlement = { id: 'entitlement-1', tier: 'free', status: 'active', boards_allowance: 1 } as any,
  used = 1, credit = false, openOrders = [] as any[], quote = {} as any, amount = tier === 'org' ? 7900 : 999 } = {}) => {
  const admin = adminClient([
    { data: { id: 'board-1', owner_id: 'user-1', season_year: 2026 } }, { data: entitlement },
    ...(entitlement?.id ? [{ count: used }] : []), { data: openOrders }, { data: null },
  ], [{ data: [{ order_id: `order-${tier}`, order_status: 'pending', already_entitled: false,
    amount_cents: credit ? 6901 : amount, credit_cents: credit ? 999 : 0, credit_source_order_id: credit ? 'source-gameday' : null,
    checkout_contest_id: 'board-1', checkout_expires_at: '2027-01-01T00:31:00Z', ...quote }] }]);
  const stripe = stripeInstance(tier, amount);
  mocks.clients.push({ auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) } }, admin);
  mocks.stripeInstances.push(stripe);
  return { admin, stripe, request: request({ contestId: 'board-1', tier, organizationName: '  Riverside   Ravens Booster Club  ', credit: 999, amount: 1 }) };
};
beforeEach(() => { mocks.clients.length = 0; mocks.stripeInstances.length = 0; vi.clearAllMocks(); });

describe.sequential('retired activation endpoint', () => {
  it('returns 410 without authentication/database access', async () => {
    const response = await activateBoard({ request: request({ contestId: 'board-1' }), env });
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ code: 'PUBLISH_IS_ALLOWANCE_BOUNDARY' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
describe.sequential('tiered checkout session endpoint', () => {
  it('creates the exact $9.99 Game Day checkout at the free limit', async () => {
    const f = checkoutFixture({ tier: 'gameday' });
    expect((await createCheckout({ request: f.request, env })).status).toBe(200);
    expect(f.stripe.prices.retrieve).toHaveBeenCalledWith('price_gameday');
    expect(f.admin.rpc).toHaveBeenNthCalledWith(1, 'gridone_claim_checkout_order_v3', {
      p_owner_id: 'user-1', p_contest_id: 'board-1', p_season_year: 2026, p_price_id: 'price_gameday', p_price_cents: 999,
      p_currency: 'usd', p_target_tier: 'gameday', p_organization_display_name: null,
    });
    expect(f.stripe.checkout.sessions.create.mock.calls[0][0]).toMatchObject({
      line_items: [{ price: 'price_gameday', quantity: 1 }], metadata: { tier: 'gameday', owner_id: 'user-1', billing_version: '3' },
      payment_intent_data: { description: 'GridOne Game Day — 2026 season', metadata: { tier: 'gameday' } },
    });
  });
  it.each([null, { id: 'e', tier: 'free', status: 'active', boards_allowance: 1 }, { id: 'e', tier: 'gameday', status: 'active', boards_allowance: 5 }])(
    'offers direct Organization before allowance exhaustion: %j', async entitlement => {
      const f = checkoutFixture({ entitlement, used: 0 });
      expect((await createCheckout({ request: f.request, env })).status).toBe(200);
      expect(f.admin.rpc).toHaveBeenNthCalledWith(1, 'gridone_claim_checkout_order_v3', expect.objectContaining({
        p_price_id: 'price_org', p_price_cents: 7900, p_target_tier: 'org', p_organization_display_name: 'Riverside Ravens Booster Club',
      }));
      expect(f.stripe.checkout.sessions.create.mock.calls[0][0]).toMatchObject({
        line_items: [{ price: 'price_org', quantity: 1 }],
        custom_text: { submit: { message: 'Riverside Ravens Booster Club — 2026 Organization plan. 50 total boards. $79.00 due.' } },
        payment_intent_data: { description: 'GridOne Organization — Riverside Ravens Booster Club', metadata: { tier: 'org', organization_name: 'Riverside Ravens Booster Club' } },
      });
    });
  it('uses only the reserved SQL credit and the existing Organization Product for the $69.01 net checkout', async () => {
    const f = checkoutFixture({ credit: true });
    expect((await createCheckout({ request: f.request, env })).status).toBe(200);
    expect(f.stripe.checkout.sessions.create.mock.calls[0][0]).toMatchObject({
      line_items: [{ price_data: { currency: 'usd', product: 'prod_org', unit_amount: 6901 }, quantity: 1 }],
      custom_text: { submit: { message: 'Riverside Ravens Booster Club — 2026 Organization plan. 50 total boards. $79.00 less verified Game Day credit $9.99: $69.01 due.' } },
    });
    expect(f.admin.rpc.mock.calls[0][1]).not.toHaveProperty('credit');
  });
  it.each([{ amount_cents: 1 }, { amount_cents: 6901, credit_cents: 999, credit_source_order_id: null }])('fails closed on malformed canonical quotes %j', async quote => {
    const f = checkoutFixture({ quote });
    expect((await createCheckout({ request: f.request, env })).status).toBe(500);
    expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it('rejects a downgrade from inactive Organization', async () => {
    const f = checkoutFixture({ tier: 'gameday', entitlement: { id: 'e', tier: 'org', status: 'revoked', boards_allowance: 50 } });
    const response = await createCheckout({ request: f.request, env });
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'WRONG_UPGRADE_TIER', offeredTier: 'org' });
    expect(mocks.Stripe).not.toHaveBeenCalled(); expect(f.admin.rpc).not.toHaveBeenCalled();
  });
  it.each([['gameday', 7900], ['org', 999]])('rejects incorrectly provisioned %s price', async (tier, amount) => {
    const f = checkoutFixture({ tier: String(tier), amount: Number(amount) });
    expect((await createCheckout({ request: f.request, env })).status).toBe(503);
    expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled(); expect(f.admin.rpc).not.toHaveBeenCalled();
  });
  it('expires a different-price open session remotely before replacing its DB reservation', async () => {
    const f = checkoutFixture({ tier: 'gameday', openOrders: [{ id: 'old', status: 'checkout_created', price_id: 'price_org', stripe_checkout_session_id: 'cs_old' }] });
    f.stripe.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_old', status: 'open', url: 'https://checkout.stripe.test/old' });
    expect((await createCheckout({ request: f.request, env })).status).toBe(200);
    expect(f.stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_old');
    expect(f.stripe.checkout.sessions.expire.mock.invocationCallOrder[0]).toBeLessThan(f.admin.rpc.mock.invocationCallOrder[0]);
  });
  it.each(['complete', 'awaiting_payment'])('never expires a %s checkout to create another', async status => {
    const f = checkoutFixture({ openOrders: [{ id: 'old', status: status === 'complete' ? 'checkout_created' : status, stripe_checkout_session_id: 'cs_old' }] });
    f.stripe.checkout.sessions.retrieve.mockResolvedValue({ status: 'complete', payment_status: 'paid' });
    expect((await createCheckout({ request: f.request, env })).status).toBe(409);
    expect(f.stripe.checkout.sessions.expire).not.toHaveBeenCalled(); expect(f.admin.rpc).not.toHaveBeenCalled();
  });
});
describe.sequential('billing status endpoint', () => {
  it('returns allowance, organization and canonical payment summary', async () => {
    mocks.clients.push({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } }, adminClient([
      { data: { id: '44444444-4444-4444-8444-444444444444', contest_id: 'board-1', season_year: 2026, status: 'paid', price_cents: 6901, credit_cents: 999, organization_display_name: 'Ravens Club' } },
      { data: { id: 'e', status: 'active', tier: 'org', boards_allowance: 50, organization_display_name: 'Ravens Club' } }, { count: 7 },
    ]));
    const response = await billingStatus({ request: new Request('https://example.test/api/billing/status?order=44444444-4444-4444-8444-444444444444', { headers: { Authorization: 'Bearer token' } }), env });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ tier: 'org', allowance: 50, used: 7, remaining: 43, organizationDisplayName: 'Ravens Club',
      entitlementStatus: 'active', orderStatus: 'paid', paymentConfirmed: true, contestId: 'board-1', amountPaidCents: 6901, creditCents: 999 });
  });
});
const webhookRequest = () => new Request('https://example.test/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'valid-signature' }, body: '{}' });
const legacyEvent = (tier: string) => ({ id: `evt_${tier}`, type: 'checkout.session.completed', data: { object: {
  id: `cs_${tier}`, payment_status: 'paid', client_reference_id: `order-${tier}`, metadata: { order_id: `order-${tier}`, tier }, payment_intent: `pi_${tier}`, customer: `cus_${tier}`,
} } });
describe.sequential('Stripe webhook price map', () => {
  it.each(['gameday', 'org'])('preserves verified old full-price %s fulfillment', async tier => {
    const amount = tier === 'org' ? 7900 : 999; const stripe = stripeInstance(tier);
    stripe.webhooks.constructEventAsync.mockResolvedValue(legacyEvent(tier));
    stripe.checkout.sessions.listLineItems.mockResolvedValue({ data: [{ price: { id: `price_${tier}` }, amount_total: amount, currency: 'usd' }] });
    const admin = adminClient([], [{ data: [{ outcome: 'fulfilled' }] }]); mocks.stripeInstances.push(stripe); mocks.clients.push(admin);
    const response = await stripeWebhook({ request: webhookRequest(), env });
    expect(response.status).toBe(200); expect(await response.text()).toBe('Fulfilled.');
    expect(admin.rpc).toHaveBeenCalledWith('gridone_fulfill_checkout_v2', expect.objectContaining({ p_price_id: `price_${tier}`, p_price_cents: amount, p_order_id: `order-${tier}` }));
  });
  it.each([
    ['gameday', 'price_unknown', 999, 'usd'], ['gameday', 'price_gameday', 7900, 'usd'],
    ['gameday', 'price_gameday', 999, 'cad'], ['org', 'price_gameday', 999, 'usd'],
  ])('rejects legacy mismatch %s %s %s %s', async (tier, price, amount, currency) => {
    const stripe = stripeInstance(); stripe.webhooks.constructEventAsync.mockResolvedValue(legacyEvent(String(tier)));
    stripe.checkout.sessions.listLineItems.mockResolvedValue({ data: [{ price: { id: price }, amount_total: amount, currency }] }); mocks.stripeInstances.push(stripe);
    expect(await (await stripeWebhook({ request: webhookRequest(), env })).text()).toBe('Ignored checkout price mismatch.');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it.each(['valid', 'owner', 'season', 'product', 'amount', 'currency', 'quantity', 'session-total', 'source-missing'])('verifies v3 credited payment: %s', async variation => {
    const stripe = stripeInstance('org');
    const order = { id: 'order-org', owner_id: 'user-1', contest_id: 'board-1', season_year: 2026, target_tier: 'org', price_id: 'price_org', price_cents: 6901,
      currency: 'usd', credit_cents: 999, credit_source_order_id: variation === 'source-missing' ? null : 'source', billing_version: 3, stripe_checkout_session_id: 'cs_org' };
    const event: any = legacyEvent('org');
    Object.assign(event.data.object, { amount_subtotal: 6901, amount_total: variation === 'session-total' ? 7900 : 6901, currency: 'usd', metadata: {
      order_id: 'order-org', billing_version: '3', tier: 'org', owner_id: variation === 'owner' ? 'other' : 'user-1', contest_id: 'board-1', season: variation === 'season' ? '2025' : '2026',
    } });
    stripe.webhooks.constructEventAsync.mockResolvedValue(event);
    stripe.checkout.sessions.listLineItems.mockResolvedValue({ data: [{
      price: { id: 'price_inline', type: 'one_time', unit_amount: 6901, product: variation === 'product' ? 'prod_other' : 'prod_org' }, quantity: variation === 'quantity' ? 2 : 1,
      amount_subtotal: 6901, amount_total: variation === 'amount' ? 1 : 6901, currency: variation === 'currency' ? 'cad' : 'usd',
    }] });
    const admin = adminClient([{ data: order }], [{ data: [{ outcome: 'fulfilled' }] }]); mocks.clients.push(admin); mocks.stripeInstances.push(stripe);
    const response = await stripeWebhook({ request: webhookRequest(), env });
    expect(response.status).toBe(200);
    if (variation === 'valid') {
      expect(await response.text()).toBe('Fulfilled.');
      expect(admin.rpc).toHaveBeenCalledWith('gridone_fulfill_checkout_v2', expect.objectContaining({ p_price_id: 'price_org', p_price_cents: 6901 }));
    } else expect(admin.rpc).not.toHaveBeenCalled();
  });
});
