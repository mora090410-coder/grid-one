import { webcrypto } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as subscribe } from '../functions/api/boards/[shareCode]/subscribe';
import { onRequestGet as verifyEmail } from '../functions/api/notifications/verify';
import { onRequestGet as unsubscribe } from '../functions/api/notifications/unsubscribe';

const mocks = vi.hoisted(() => {
  const clients: any[] = [];
  const createClient = vi.fn(() => {
    const client = clients.shift();
    if (!client) throw new Error('No scripted Supabase client remains.');
    return client;
  });
  return { clients, createClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  EMAIL_PROVIDER_API_KEY: 'email-key',
  EMAIL_FROM: 'GridOne <updates@getgridone.com>',
  NOTIFICATION_TOKEN_SECRET: 'notification-secret',
  PUBLIC_SITE_URL: 'https://www.getgridone.com',
};

type ScriptedResult = { data?: any; error?: any };

const scriptedAdmin = (results: ScriptedResult[] = []) => {
  const operations: Array<{ table: string; method: string; value?: any }> = [];
  const from = vi.fn((table: string) => {
    const terminal = () => Promise.resolve(results.shift() || { data: null, error: null });
    const chain: any = {};
    for (const method of ['select', 'eq', 'is', 'gte', 'ilike']) {
      chain[method] = vi.fn((...args: any[]) => {
        operations.push({ table, method, value: args });
        return chain;
      });
    }
    for (const method of ['insert', 'update']) {
      chain[method] = vi.fn((value: any) => {
        operations.push({ table, method, value });
        return chain;
      });
    }
    chain.maybeSingle = vi.fn(terminal);
    chain.single = vi.fn(terminal);
    chain.then = (resolve: any, reject: any) => terminal().then(resolve, reject);
    return chain;
  });
  return { from, operations };
};

const subscribeRequest = (body: Record<string, unknown>) => new Request(
  'https://example.test/api/boards/ABCDEFGH/subscribe',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  },
);

const redirectLocation = (response: Response) => response.headers.get('location') || '';

const hmacToken = async (secret: string, subscriptionId: string) => {
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await webcrypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(subscriptionId),
  );
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
};

beforeAll(() => {
  // The shared jsdom setup provides digest only. Add the Web Crypto methods
  // required by production unsubscribe verification without replacing crypto.
  Object.assign(globalThis.crypto, {
    randomUUID: webcrypto.randomUUID.bind(webcrypto),
  });
  Object.assign(globalThis.crypto.subtle, {
    importKey: webcrypto.subtle.importKey.bind(webcrypto.subtle),
    sign: webcrypto.subtle.sign.bind(webcrypto.subtle),
    verify: webcrypto.subtle.verify.bind(webcrypto.subtle),
  });
});

beforeEach(() => {
  mocks.clients.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe.sequential('winner email subscription endpoint', () => {
  it('rejects invalid email before reading board data', async () => {
    const response = await subscribe({
      request: subscribeRequest({ participantId: 'participant-1', email: 'not-an-email' }),
      env,
      params: { shareCode: 'ABCDEFGH' },
    });
    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('not-an-email');
  });

  it('requires a currently published board snapshot', async () => {
    mocks.clients.push(scriptedAdmin([{ data: null }]));
    const response = await subscribe({
      request: subscribeRequest({ participantId: 'participant-1', email: 'parent@example.com' }),
      env,
      params: { shareCode: 'ABCDEFGH' },
    });
    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).not.toContain('parent@example.com');
  });

  it('requires the participant to belong to the published board', async () => {
    mocks.clients.push(scriptedAdmin([
      { data: { contest_id: 'contest-1', board_title: 'Week One' } },
      { data: null },
    ]));
    const response = await subscribe({
      request: subscribeRequest({ participantId: 'other-board-player', email: 'parent@example.com' }),
      env,
      params: { shareCode: 'ABCDEFGH' },
    });
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).not.toContain('parent@example.com');
    expect(body).not.toContain('other-board-player');
  });

  it('normalizes email, stores only token hashes, and returns no email or raw token', async () => {
    const admin = scriptedAdmin([
      { data: { contest_id: 'contest-1', board_title: 'Week One' } },
      { data: { id: 'participant-1', display_name: 'Parent One' } },
      { data: null },
      { data: { id: 'subscription-1' }, error: null },
    ]);
    mocks.clients.push(admin);
    const providerFetch = vi.fn(async (..._args: any[]) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await subscribe({
      request: subscribeRequest({ participantId: 'participant-1', email: '  Parent@Example.COM  ' }),
      env,
      params: { shareCode: 'abcdefgh' },
    });
    expect(response.status).toBe(200);
    const responseBody = await response.text();
    expect(JSON.parse(responseBody)).toEqual({ sent: true });

    const inserted = admin.operations.find(operation =>
      operation.table === 'notification_subscriptions' && operation.method === 'insert'
    )?.value;
    expect(inserted.email).toBe('parent@example.com');
    expect(inserted.verification_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(inserted.unsubscribe_token_hash).toMatch(/^[a-f0-9]{64}$/);

    const providerBody = JSON.parse(String(providerFetch.mock.calls[0][1]?.body));
    expect(providerBody.to).toEqual(['parent@example.com']);
    const verifyHref = providerBody.html.match(/href="([^"]+)"/)?.[1];
    expect(verifyHref).toBeTruthy();
    const rawVerificationToken = new URL(String(verifyHref)).searchParams.get('token');
    expect(rawVerificationToken).toBeTruthy();
    expect(inserted.verification_token_hash).not.toBe(rawVerificationToken);
    expect(responseBody).not.toContain('parent@example.com');
  });

  it('reports provider failure without leaking email or verification token', async () => {
    const admin = scriptedAdmin([
      { data: { contest_id: 'contest-1', board_title: 'Week One' } },
      { data: { id: 'participant-1', display_name: 'Parent One' } },
      { data: null },
      { data: { id: 'subscription-1' }, error: null },
      { data: null, error: null },
    ]);
    mocks.clients.push(admin);
    const providerFetch = vi.fn(async (..._args: any[]) => new Response('provider detail', { status: 503 }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await subscribe({
      request: subscribeRequest({ participantId: 'participant-1', email: 'parent@example.com' }),
      env,
      params: { shareCode: 'ABCDEFGH' },
    });
    expect(response.status).toBe(502);
    const responseBody = await response.text();
    expect(responseBody).not.toContain('parent@example.com');
    expect(responseBody).not.toContain('provider detail');
    const providerBody = JSON.parse(String(providerFetch.mock.calls[0][1]?.body));
    const verifyHref = providerBody.html.match(/href="([^"]+)"/)?.[1];
    expect(verifyHref).toBeTruthy();
    const token = new URL(String(verifyHref)).searchParams.get('token');
    expect(token).toBeTruthy();
    expect(responseBody).not.toContain(String(token));
  });
});

describe.sequential('winner email verification endpoint', () => {
  const verifyRequest = (token: string) => new Request(
    `https://example.test/api/notifications/verify?subscription=subscription-1&token=${encodeURIComponent(token)}&board=ABCDEFGH`,
  );

  it('redirects a valid, unexpired token to the verified board state', async () => {
    const admin = scriptedAdmin([{ data: { id: 'subscription-1' } }]);
    mocks.clients.push(admin);
    const response = await verifyEmail({ request: verifyRequest('valid-token'), env });
    expect(response.status).toBe(302);
    expect(redirectLocation(response)).toBe('https://www.getgridone.com/b/ABCDEFGH?email=verified');
    expect(redirectLocation(response)).not.toContain('valid-token');
    expect(admin.operations.some(operation => operation.method === 'gte')).toBe(true);
  });

  it.each([
    ['expired', 'expired-token'],
    ['invalid', 'invalid-token'],
  ])('redirects an %s token without exposing it', async (_label, token) => {
    mocks.clients.push(scriptedAdmin([{ data: null }]));
    const response = await verifyEmail({ request: verifyRequest(token), env });
    expect(response.status).toBe(302);
    expect(redirectLocation(response)).toBe('https://www.getgridone.com/b/ABCDEFGH?email=invalid');
    expect(redirectLocation(response)).not.toContain(token);
  });
});

describe.sequential('winner email unsubscribe endpoint', () => {
  const unsubscribeRequest = (token: string) => new Request(
    `https://example.test/api/notifications/unsubscribe?subscription=subscription-1&token=${encodeURIComponent(token)}&board=ABCDEFGH`,
  );

  it('accepts a valid signature and redirects without leaking it', async () => {
    const token = await hmacToken(env.NOTIFICATION_TOKEN_SECRET, 'subscription-1');
    mocks.clients.push(scriptedAdmin([{ data: { id: 'subscription-1' } }]));
    const response = await unsubscribe({ request: unsubscribeRequest(token), env });
    expect(response.status).toBe(302);
    expect(redirectLocation(response)).toBe('https://www.getgridone.com/b/ABCDEFGH?email=unsubscribed');
    expect(redirectLocation(response)).not.toContain(token);
  });

  it('rejects an invalid signature without touching storage or exposing it', async () => {
    const token = 'invalid-signature';
    const response = await unsubscribe({ request: unsubscribeRequest(token), env });
    expect(response.status).toBe(302);
    expect(redirectLocation(response)).toBe('https://www.getgridone.com/b/ABCDEFGH?email=unsubscribe-invalid');
    expect(redirectLocation(response)).not.toContain(token);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
