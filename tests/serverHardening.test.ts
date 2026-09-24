import { webcrypto } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const clients: any[] = [];
  const createClient = vi.fn(() => {
    const client = clients.shift();
    if (!client) throw new Error('No scripted Supabase client remains.');
    return client;
  });
  const stripeInstances: any[] = [];
  const Stripe = vi.fn(function StripeMock() {
    const instance = stripeInstances.shift();
    if (!instance) throw new Error('No scripted Stripe instance remains.');
    return instance;
  });
  (Stripe as any).createFetchHttpClient = vi.fn(() => ({}));
  return {
    clients, createClient, stripeInstances, Stripe,
    fetchScheduledGameById: vi.fn(),
    fetchScheduledGames: vi.fn(),
  };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('stripe', () => ({ default: mocks.Stripe }));
vi.mock('../functions/_lib/espnNfl', async (importOriginal) => ({
  ...await importOriginal<typeof import('../functions/_lib/espnNfl')>(),
  fetchScheduledGameById: mocks.fetchScheduledGameById,
  fetchScheduledGames: mocks.fetchScheduledGames,
}));

import * as poolsModule from '../functions/api/pools';
import * as poolModule from '../functions/api/pools/[id]';
import { onRequestPost as publishBoard } from '../functions/api/pools/[id]/publish';
import { onRequestPost as shareBoard } from '../functions/api/pools/[id]/share';
import { onRequestPost as correctMilestone } from '../functions/api/pools/[id]/milestones/[milestone]/correct';
import { onRequestPost as manualScore } from '../functions/api/pools/[id]/score/manual';
import { onRequestPost as scanBoard } from '../functions/api/boards/scan';
import { onRequestPost as subscribe } from '../functions/api/boards/[shareCode]/subscribe';
import { onRequestGet as billingStatus } from '../functions/api/billing/status';
import { onRequestPost as createCheckout } from '../functions/api/stripe/create-checkout-session';
import { onRequestPost as stripeWebhook } from '../functions/api/stripe/webhook';
import { onRequestPost as openSquares } from '../functions/api/pools/[id]/open-squares';
import { onRequestGet as nflGames } from '../functions/api/nfl/games';

const ID = '11111111-1111-4111-8111-111111111111';
const USER = { id: '22222222-2222-4222-8222-222222222222', email: 'o@example.test', email_confirmed_at: '2026-01-01' };
const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

const authClient = (result: any = { data: { user: USER }, error: null }, extra: Record<string, unknown> = {}) => ({
  auth: { getUser: vi.fn(async () => result) },
  ...extra,
});

const post = (url: string, body: string | null, token: string | null = 'token', headers: Record<string, string> = {}) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === null ? {} : { body }),
  });

/** A chainable query whose terminal calls resolve the next scripted result. */
const scriptedAdmin = (results: any[] = [], rpcResults: any[] = []) => {
  const calls: Array<[string, unknown[]]> = [];
  const chain: any = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'then') return undefined;
      if (['maybeSingle', 'single'].includes(prop)) return vi.fn(async () => results.shift() ?? { data: null, error: null });
      return (...args: unknown[]) => { calls.push([prop, args]); return chain; };
    },
  });
  return {
    calls,
    from: vi.fn((table: string) => { calls.push(['from', [table]]); return chain; }),
    rpc: vi.fn(async () => rpcResults.shift() ?? { data: null, error: null }),
  };
};

beforeAll(() => {
  // tests/setup.ts installs a partial crypto mock; these handlers need real UUIDs and HMAC.
  Object.assign(globalThis.crypto, { randomUUID: webcrypto.randomUUID.bind(webcrypto) });
  Object.assign(globalThis.crypto.subtle, {
    importKey: webcrypto.subtle.importKey.bind(webcrypto.subtle),
    sign: webcrypto.subtle.sign.bind(webcrypto.subtle),
  });
});

beforeEach(() => {
  mocks.clients.length = 0;
  mocks.stripeInstances.length = 0;
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('board CORS remnants are gone', () => {
  it('exports no OPTIONS handlers and sends no cross-origin headers', async () => {
    expect((poolsModule as any).onRequestOptions).toBeUndefined();
    expect((poolModule as any).onRequestOptions).toBeUndefined();
    const response = await poolsModule.onRequestPost({ request: post('https://getgridone.com/api/pools', '{}', null), env });
    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('allowance errors share one copy table', () => {
  const publishWith = async (message: string) => {
    const admin = scriptedAdmin([{ data: {
      id: ID, share_code: 'ABCDEFGH', owner_id: USER.id, revision: 4, settings: {},
      board_data: { leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0], squares: Array.from({ length: 100 }, (_, i) => [`B${i}`]) },
      side_team_abbr: 'CHI', top_team_abbr: 'GB',
    }, error: null }], [{ data: null, error: { message } }]);
    mocks.clients.push(authClient(), admin);
    return publishBoard({ request: post(`https://example.test/api/pools/${ID}/publish`, JSON.stringify({ revision: 4 })), env, params: { id: ID } });
  };
  const shareWith = async (message: string) => {
    mocks.clients.push(authClient(), scriptedAdmin([], [{ data: null, error: { message } }]));
    return shareBoard({ request: post(`https://example.test/api/pools/${ID}/share`, JSON.stringify({ revision: 4 })), env, params: { id: ID } });
  };

  it('tells an exhausted Organization organizer the 50-board limit with no upgrade', async () => {
    const body = await (await publishWith('PUBLISH_ALLOWANCE_EXHAUSTED:org:50:50')).json();
    expect(body).toEqual({
      code: 'PUBLISH_ALLOWANCE_EXHAUSTED',
      error: 'Your Organization plan has published all 50 boards for this season.',
      tier: 'org', used: 50, allowance: 50, upgradeTo: null,
    });
  });

  it('names the inactive plan instead of the Game Day limit', async () => {
    const org = await (await publishWith('PUBLISH_ENTITLEMENT_INACTIVE:org:3:50')).json();
    expect(org).toMatchObject({ code: 'PUBLISH_ENTITLEMENT_INACTIVE', upgradeTo: 'org' });
    expect(org.error).toMatch(/Organization plan is no longer active/);
    const gameday = await (await publishWith('PUBLISH_ENTITLEMENT_INACTIVE:gameday:2:5')).json();
    expect(gameday).toMatchObject({ upgradeTo: 'gameday' });
    expect(gameday.error).toMatch(/Game Day plan is no longer active/);
  });

  it('gives share and publish the same answer for the same allowance edge', async () => {
    for (const message of ['PUBLISH_ALLOWANCE_EXHAUSTED:gameday:5:5', 'PUBLISH_ALLOWANCE_EXHAUSTED:org:50:50', 'PUBLISH_ENTITLEMENT_INACTIVE:org:1:50']) {
      const published = await (await publishWith(message)).json();
      const shared = await shareWith(message);
      expect(shared.status).toBe(402);
      expect(await shared.json()).toEqual(published);
    }
  });
});

describe('request bodies are bounded objects', () => {
  it('returns 400 instead of throwing for malformed correction JSON', async () => {
    mocks.clients.push(authClient());
    const response = await correctMilestone({ request: post(`https://x.test/api/pools/${ID}/milestones/Q1/correct`, '{not json'), env, params: { id: ID, milestone: 'Q1' } });
    expect(response.status).toBe(400);
  });

  it('returns 400 instead of throwing for malformed manual-score JSON', async () => {
    mocks.clients.push(authClient(), scriptedAdmin([{ data: { id: ID, status: 'published', published_at: '2026-09-01', game_external_id: '1' }, error: null }]));
    const response = await manualScore({ request: post(`https://x.test/api/pools/${ID}/score/manual`, 'null'), env, params: { id: ID } });
    expect(response.status).toBe(400);
  });

  it('returns 400 for a malformed scan body and 413 for an oversized one', async () => {
    const scanEnv = { ...env, GEMINI_API_KEY: 'gemini-key' };
    mocks.clients.push(authClient());
    expect((await scanBoard({ request: post('https://x.test/api/boards/scan', '[]'), env: scanEnv })).status).toBe(400);
    mocks.clients.push(authClient());
    const huge = await scanBoard({ request: post('https://x.test/api/boards/scan', JSON.stringify({ image: 'x'.repeat(9_000_000) })), env: scanEnv });
    expect(huge.status).toBe(413);
    expect((await huge.json()).error).toMatch(/under 6 MB/);
  });

  it('returns 400 without leaking parser text when a board update body is null', async () => {
    mocks.clients.push(authClient());
    const response = await poolModule.onRequestPut({ request: new Request(`https://x.test/api/pools/${ID}`, { method: 'PUT', headers: { Authorization: 'Bearer token' }, body: 'null' }), env, params: { id: ID } });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid request body.');
  });

  it('returns 400 without SyntaxError text when a board create body is not JSON', async () => {
    const response = await poolsModule.onRequestPost({ request: post('https://x.test/api/pools', '{"game":'), env });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toMatch(/JSON|position|Unexpected/);
  });

  it('returns 400 when a checkout body is null', async () => {
    mocks.clients.push(authClient());
    const response = await createCheckout({ request: post('https://x.test/api/stripe/create-checkout-session', 'null'), env: { ...env, STRIPE_SECRET_KEY: 'sk' } });
    expect(response.status).toBe(400);
  });
});

describe('route ids are validated before Postgres', () => {
  it('rejects a non-UUID publish id without touching the database', async () => {
    const response = await publishBoard({ request: post('https://x.test/api/pools/nope/publish', '{}'), env, params: { id: 'nope' } });
    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID correction id', async () => {
    const response = await correctMilestone({ request: post('https://x.test/x', '{}'), env, params: { id: 'nope', milestone: 'Q1' } });
    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID manual-score id', async () => {
    const response = await manualScore({ request: post('https://x.test/x', '{}'), env, params: { id: 'nope' } });
    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('treats a malformed checkout order id as not found', async () => {
    const admin = scriptedAdmin();
    mocks.clients.push(authClient(), admin);
    const response = await billingStatus({ request: new Request('https://x.test/api/billing/status?order=1%27', { headers: { Authorization: 'Bearer token' } }), env });
    expect(response.status).toBe(404);
    expect(admin.from).not.toHaveBeenCalledWith('checkout_orders');
  });
});

describe('milestone correction success path', () => {
  it('passes the verified owner and parsed correction to the audited RPC', async () => {
    const admin = scriptedAdmin([], [{ data: [{ resolution: { milestone: 'Q1' }, winner_history: [{ milestone: 'Q1' }], pending_milestones: [], delivery_ids: ['a', 'b'] }], error: null }]);
    mocks.clients.push(authClient(), admin);
    const response = await correctMilestone({
      request: post('https://x.test/x', JSON.stringify({ expectedVersion: 2, sideScore: 7, topScore: 3, reason: ' Official correction ' })),
      env, params: { id: ID, milestone: 'q1' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      resolution: { milestone: 'Q1' }, winnerHistory: [{ milestone: 'Q1' }], pendingMilestones: [], correctionDeliveriesQueued: 2,
    });
    expect(admin.rpc).toHaveBeenCalledWith('gridone_correct_milestone', {
      p_contest_id: ID, p_owner_id: USER.id, p_milestone: 'Q1', p_expected_version: 2,
      p_side_score: 7, p_top_score: 3, p_reason: 'Official correction',
    });
  });

  it('keeps the unconfirmed-milestone refusal readable', async () => {
    mocks.clients.push(authClient(), scriptedAdmin([], [{ data: null, error: { message: 'Milestone has not been confirmed' } }]));
    const response = await correctMilestone({
      request: post('https://x.test/x', JSON.stringify({ expectedVersion: 1, sideScore: 7, topScore: 3, reason: 'Official correction' })),
      env, params: { id: ID, milestone: 'Q2' },
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/not been confirmed/);
  });
});

describe('server failures are masked', () => {
  it('does not return raw Postgres text from a failed correction', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.clients.push(authClient(), scriptedAdmin([], [{ data: null, error: { message: 'relation "secret_table" does not exist' } }]));
    const response = await correctMilestone({
      request: post('https://x.test/x', JSON.stringify({ expectedVersion: 1, sideScore: 7, topScore: 3, reason: 'Official correction' })),
      env, params: { id: ID, milestone: 'Q1' },
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret_table');
    expect(error).toHaveBeenCalled();
  });

  it('does not return raw Postgres text from a failed publish lookup', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.clients.push(authClient(), scriptedAdmin([{ data: null, error: { message: 'invalid input syntax for type uuid' } }]));
    const response = await publishBoard({ request: post('https://x.test/x', JSON.stringify({ revision: 4 })), env, params: { id: ID } });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('syntax');
  });

  it('keeps user-facing 409 publish messages but masks unexpected RPC text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const run = async (message: string) => {
      mocks.clients.push(authClient(), scriptedAdmin([{ data: {
        id: ID, revision: 4, settings: {}, side_team_abbr: 'CHI', top_team_abbr: 'GB',
        board_data: { leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0], squares: Array.from({ length: 100 }, (_, i) => [`B${i}`]) },
      }, error: null }], [{ data: null, error: { message } }]));
      return publishBoard({ request: post('https://x.test/x', JSON.stringify({ revision: 4 })), env, params: { id: ID } });
    };
    const conflict = await run('Link a scheduled NFL game before publishing.');
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toBe('Link a scheduled NFL game before publishing.');
    const unexpected = await run('deadlock detected on relation contests');
    expect(unexpected.status).toBe(500);
    expect(await unexpected.text()).not.toContain('deadlock');
  });

  it('does not return raw Postgres text from a failed open-square lookup', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.clients.push(authClient(), scriptedAdmin([{ data: null, error: { message: 'permission denied for table contests' } }]));
    const response = await openSquares({
      request: post('https://x.test/x', JSON.stringify({ revision: 1, squares: Array.from({ length: 100 }, (_, i) => (i ? [] : ['A'])) })),
      env, params: { id: ID },
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('permission denied');
  });
});

describe('an auth outage is not an expired session', () => {
  it.each([
    ['a 5xx from the auth service', { status: 503, name: 'AuthApiError', message: 'upstream' }],
    ['a rate limit', { status: 429, name: 'AuthApiError', message: 'too many' }],
    ['a network failure', { status: 0, name: 'AuthRetryableFetchError', message: 'fetch failed' }],
  ])('returns 503 for %s', async (_name, error) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.clients.push(authClient({ data: { user: null }, error }));
    const response = await publishBoard({ request: post('https://x.test/x', '{}'), env, params: { id: ID } });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('Sign-in is temporarily unavailable. Try again.');
  });

  it('still returns the existing 401 when the token is rejected', async () => {
    mocks.clients.push(authClient({ data: { user: null }, error: { status: 403, name: 'AuthApiError', message: 'bad jwt' } }));
    const response = await publishBoard({ request: post('https://x.test/x', '{}'), env, params: { id: ID } });
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Your session has expired.');
  });

  it('returns 503 on the owner board read instead of a not-found board', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.clients.push(scriptedAdmin(), authClient({ data: { user: null }, error: { status: 500, name: 'AuthApiError' } }));
    const response = await poolModule.onRequestGet({ request: new Request(`https://x.test/api/pools/${ID}`, { headers: { Authorization: 'Bearer token' } }), env, params: { id: ID } });
    expect(response.status).toBe(503);
  });
});

describe('public share-code reads never authenticate', () => {
  it('does not verify a bearer token on the share-code path', async () => {
    const admin = scriptedAdmin();
    const anon = authClient();
    mocks.clients.push(admin, anon);
    const response = await poolModule.onRequestGet({ request: new Request('https://x.test/api/pools/ABCDEFGH', { headers: { Authorization: 'Bearer token' } }), env, params: { id: 'ABCDEFGH' } });
    expect(response.status).toBe(404);
    expect(anon.auth.getUser).not.toHaveBeenCalled();
  });
});

describe('external providers have timeouts and stay private', () => {
  const scanEnv = { ...env, GEMINI_API_KEY: 'gemini-secret-key', OCR_MODEL: 'gemini-test' };
  const image = JSON.stringify({ image: 'data:image/png;base64,QUJDRA==' });

  it('sends the Gemini key in a header with a timeout signal', async () => {
    const fetchMock = vi.fn(async (..._args: any[]) => new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    mocks.clients.push(authClient());
    await scanBoard({ request: post('https://x.test/api/boards/scan', image), env: scanEnv });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('gemini-secret-key');
    expect(String(url)).not.toContain('key=');
    expect(init.headers['x-goog-api-key']).toBe('gemini-secret-key');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not forward the provider error text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'API key gemini-secret-key quota exceeded for project 1234' } }), { status: 429 })));
    mocks.clients.push(authClient());
    const response = await scanBoard({ request: post('https://x.test/api/boards/scan', image), env: scanEnv });
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toContain('The scan provider is unavailable.');
    expect(text).not.toContain('quota');
  });

  it('maps a scan timeout to a masked 502', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('The operation timed out.', 'TimeoutError'); }));
    mocks.clients.push(authClient());
    const response = await scanBoard({ request: post('https://x.test/api/boards/scan', image), env: scanEnv });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('timed out');
  });

  it('bounds the verification email send and records a timeout as a provider failure', async () => {
    const subscribeEnv = { ...env, EMAIL_PROVIDER_API_KEY: 'resend', EMAIL_FROM: 'GridOne <a@b.c>', NOTIFICATION_TOKEN_SECRET: 'secret' };
    const fetchMock = vi.fn(async (_url: any, init: any) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchMock);
    const admin = scriptedAdmin(
      [{ data: { contest_id: ID, board_title: 'Board', contest: { id: ID, status: 'published' } }, error: null }],
      [
        { data: [{ should_send: true, claim_id: 'claim', subscription_id: ID, participant_name: 'Pat' }], error: null },
        { data: null, error: null },
      ],
    );
    mocks.clients.push(admin);
    const response = await subscribe({
      request: post('https://x.test/api/boards/ABCDEFGH/subscribe', JSON.stringify({ participantId: ID, email: 'pat@example.test' }), null, { 'CF-Connecting-IP': '203.0.113.9' }),
      env: subscribeEnv, params: { shareCode: 'ABCDEFGH' },
    });
    expect(response.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenLastCalledWith('gridone_complete_notification_send', expect.objectContaining({
      p_outcome: 'provider_failed',
      p_error: 'Email provider request timed out',
    }));
  });
});

describe('one season source of truth', () => {
  const scheduled = {
    id: '401772510', kickoffAt: '2027-09-13T17:00:00.000Z', state: 'pre' as const, season: 2027, week: 1,
    awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' }, homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
  };

  it('creates boards in the configured season', async () => {
    mocks.fetchScheduledGameById.mockResolvedValue(scheduled);
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: ID, share_code: 'ABCDEFGH', revision: 1 }, error: null }) }) }));
    mocks.clients.push(authClient(undefined, { from: vi.fn(() => ({ insert })) }));
    const response = await poolsModule.onRequestPost({
      request: post('https://x.test/api/pools', JSON.stringify({ game: { title: 'Board', gameExternalId: scheduled.id }, board: { squares: Array.from({ length: 100 }, () => []) } })),
      env: { ...env, GRIDONE_SEASON: '2027' },
    });
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ season_year: 2027 }));
  });

  it('looks up checkout entitlements in the configured season', async () => {
    const admin = scriptedAdmin([{ data: { id: ID, owner_id: USER.id, season_year: 2027 }, error: null }, { data: null, error: null }]);
    mocks.clients.push(authClient(), admin);
    await createCheckout({
      request: post('https://x.test/api/stripe/create-checkout-session', JSON.stringify({ contestId: ID, tier: 'gameday' })),
      env: { ...env, STRIPE_SECRET_KEY: 'sk', STRIPE_GAMEDAY_PRICE_ID: 'price_gameday', PAID_SIGNUP_ENABLED: 'true', GRIDONE_SEASON: '2027' },
    });
    expect(admin.calls).toContainEqual(['eq', ['season_year', 2027]]);
    expect(admin.calls).not.toContainEqual(['eq', ['season_year', 2026]]);
  });
});

describe('stripe webhook price mismatch', () => {
  it('logs a paid checkout that does not match the configured price', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.stripeInstances.push({
      webhooks: { constructEventAsync: vi.fn(async () => ({
        id: 'evt_1', type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_mismatch', payment_status: 'paid', client_reference_id: ID, metadata: { order_id: ID, tier: 'gameday' } } },
      })) },
      checkout: { sessions: { listLineItems: vi.fn(async () => ({ data: [{ price: 'price_other', amount_total: 100, currency: 'usd' }] })) } },
    });
    const response = await stripeWebhook({
      request: new Request('https://x.test/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'sig' }, body: '{}' }),
      env: { ...env, STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'whsec', STRIPE_GAMEDAY_PRICE_ID: 'price_gameday' },
    });
    expect(response.status).toBe(200);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/price mismatch/i), expect.objectContaining({ sessionId: 'cs_test_mismatch', eventId: 'evt_1' }));
  });
});

describe('NFL schedule edge cache', () => {
  it('serves repeat public schedule requests from the edge cache', async () => {
    const store = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (key: string) => store.get(key)?.clone()),
      put: vi.fn(async (key: string, response: Response) => { store.set(key, response); }),
    };
    vi.stubGlobal('caches', { default: cache });
    const games = [{ id: '1' }];
    mocks.fetchScheduledGames.mockResolvedValue(games);
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise);
    const first = await nflGames({ request: new Request('https://x.test/api/nfl/games?limit=50&scope=upcoming'), env, waitUntil });
    await Promise.all(waitUntil.mock.calls.map(([promise]) => promise));
    const second = await nflGames({ request: new Request('https://x.test/api/nfl/games?scope=upcoming&limit=50'), env, waitUntil });
    expect(await first.json()).toEqual({ games });
    expect(await second.json()).toEqual({ games });
    expect(mocks.fetchScheduledGames).toHaveBeenCalledTimes(1);
  });

  it('never pins an empty public schedule at the edge', async () => {
    const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => undefined) };
    vi.stubGlobal('caches', { default: cache });
    mocks.fetchScheduledGames.mockResolvedValueOnce([]);
    const waitUntil = vi.fn();
    const response = await nflGames({ request: new Request('https://x.test/api/nfl/games'), env, waitUntil });
    expect(await response.json()).toEqual({ games: [] });
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('never caches an error or the private completed-game list', async () => {
    const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => undefined) };
    vi.stubGlobal('caches', { default: cache });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.fetchScheduledGames.mockRejectedValueOnce(new Error('down'));
    const waitUntil = vi.fn();
    expect((await nflGames({ request: new Request('https://x.test/api/nfl/games'), env, waitUntil })).status).toBe(502);
    expect(cache.put).not.toHaveBeenCalled();

    mocks.fetchScheduledGames.mockResolvedValueOnce([]);
    mocks.clients.push(authClient());
    const completed = await nflGames({
      request: new Request('https://x.test/api/nfl/games?scope=completed', { headers: { Authorization: 'Bearer token' } }),
      env: { ...env, SCORE_TEST_MODE_ENABLED: 'true', SCORE_TEST_MODE_OWNER_IDS: USER.id }, waitUntil,
    });
    expect(completed.headers.get('Cache-Control')).toBe('private, no-store');
    expect(cache.match).not.toHaveBeenCalledWith(expect.stringContaining('scope=completed'));
    expect(cache.put).not.toHaveBeenCalled();
  });
});
