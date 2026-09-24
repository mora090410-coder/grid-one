import { webcrypto } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as unsubscribeEndpoint from '../functions/api/notifications/unsubscribe';
import * as verifyEndpoint from '../functions/api/notifications/verify';
import { onRequestPost as retry } from '../functions/api/notifications/retry';
import { onRequestPost as subscribe } from '../functions/api/boards/[shareCode]/subscribe';
import { signUnsubscribe, verifyUnsubscribeToken } from '../functions/_lib/winnerNotifications';

// Mail-security scanners (Outlook Safe Links, Gmail/Proofpoint prefetch) GET every
// link in an email. A GET must never change state; only an explicit POST does.

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

const env = {
  CRON_SECRET: 'cron-secret',
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  EMAIL_PROVIDER_API_KEY: 'email-key',
  EMAIL_FROM: 'GridOne <updates@getgridone.com>',
  NOTIFICATION_TOKEN_SECRET: 'notification-secret',
  PUBLIC_SITE_URL: 'https://www.getgridone.com',
};

const SUBSCRIPTION_ID = '30000000-0000-4000-8000-000000000001';

const unsubscribeAdmin = () => {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: SUBSCRIPTION_ID }, error: null }),
  };
  const admin = { from: vi.fn().mockReturnValue(query), rpc: vi.fn() };
  mocks.createClient.mockReturnValue(admin);
  return { admin, query };
};

const verifyAdmin = () => {
  const admin = { from: vi.fn(), rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
  mocks.createClient.mockReturnValue(admin);
  return admin;
};

const unsubscribeUrl = (token: string) =>
  `https://www.getgridone.com/api/notifications/unsubscribe?subscription=${SUBSCRIPTION_ID}&token=${token}&board=ABCDEFGH`;
const verifyUrl = (token: string) =>
  `https://www.getgridone.com/api/notifications/verify?subscription=${SUBSCRIPTION_ID}&token=${token}&board=ABCDEFGH`;

const expectSafeConfirmPage = async (response: Response, buttonLabel: string, token: string) => {
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('x-robots-tag')).toBe('noindex');
  const body = await response.text();
  expect(body).toContain('<html lang="en">');
  expect(body).toMatch(/<form method="post" action="[^"]+">/);
  expect(body).toContain(`<button type="submit"`);
  expect(body).toContain(`>${buttonLabel}</button>`);
  // Exactly one action on the page.
  expect(body.match(/<form/g)).toHaveLength(1);
  // The form posts back to the same signed link (escaped for HTML).
  const action = body.match(/<form method="post" action="([^"]+)">/)?.[1] || '';
  const decoded = action.replaceAll('&amp;', '&');
  const posted = new URL(decoded, 'https://www.getgridone.com');
  expect(posted.searchParams.get('token')).toBe(token);
  expect(posted.searchParams.get('subscription')).toBe(SUBSCRIPTION_ID);
  expect(posted.searchParams.get('board')).toBe('ABCDEFGH');
  expect(body).toContain('GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.');
  return body;
};

beforeAll(() => {
  Object.assign(globalThis.crypto, { randomUUID: webcrypto.randomUUID.bind(webcrypto) });
  Object.assign(globalThis.crypto.subtle, {
    importKey: webcrypto.subtle.importKey.bind(webcrypto.subtle),
    sign: webcrypto.subtle.sign.bind(webcrypto.subtle),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReset();
  vi.unstubAllGlobals();
});

describe('unsubscribe link is safe from link scanners', () => {
  it('GET shows a confirmation form and changes nothing', async () => {
    const token = await signUnsubscribe(env.NOTIFICATION_TOKEN_SECRET, SUBSCRIPTION_ID);
    const { query } = unsubscribeAdmin();
    const response = await unsubscribeEndpoint.onRequestGet({ request: new Request(unsubscribeUrl(token)), env });
    await expectSafeConfirmPage(response, 'Unsubscribe', token);
    expect(query.update).not.toHaveBeenCalled();
  });

  it('GET with a bad signature still redirects to the invalid state without touching storage', async () => {
    const response = await unsubscribeEndpoint.onRequestGet({ request: new Request(unsubscribeUrl('bad')), env });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://www.getgridone.com/b/ABCDEFGH?email=unsubscribe-invalid');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('the form-button POST unsubscribes and shows the unsubscribed board state', async () => {
    const token = await signUnsubscribe(env.NOTIFICATION_TOKEN_SECRET, SUBSCRIPTION_ID);
    const { query } = unsubscribeAdmin();
    const response = await unsubscribeEndpoint.onRequestPost({
      request: new Request(unsubscribeUrl(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '',
      }),
      env,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://www.getgridone.com/b/ABCDEFGH?email=unsubscribed');
    expect(response.headers.get('location')).not.toContain(token);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(query.eq).toHaveBeenCalledWith('id', SUBSCRIPTION_ID);
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'unsubscribed' }));
  });

  it('accepts the RFC 8058 one-click POST with the token in the URL', async () => {
    const token = await signUnsubscribe(env.NOTIFICATION_TOKEN_SECRET, SUBSCRIPTION_ID);
    const { query } = unsubscribeAdmin();
    const response = await unsubscribeEndpoint.onRequestPost({
      request: new Request(unsubscribeUrl(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      }),
      env,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://www.getgridone.com/b/ABCDEFGH?email=unsubscribed');
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'unsubscribed' }));
  });

  it('POST with a bad signature does not touch storage', async () => {
    const response = await unsubscribeEndpoint.onRequestPost({
      request: new Request(unsubscribeUrl('bad'), { method: 'POST', body: 'List-Unsubscribe=One-Click' }),
      env,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://www.getgridone.com/b/ABCDEFGH?email=unsubscribe-invalid');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe('verification link is safe from link scanners', () => {
  it('GET shows a confirmation form and does not verify', async () => {
    const admin = verifyAdmin();
    const response = await verifyEndpoint.onRequestGet({ request: new Request(verifyUrl('raw-token')), env });
    await expectSafeConfirmPage(response, 'Confirm my email', 'raw-token');
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('GET without a token redirects to the invalid state', async () => {
    const response = await verifyEndpoint.onRequestGet({
      request: new Request(`https://www.getgridone.com/api/notifications/verify?subscription=${SUBSCRIPTION_ID}&board=ABCDEFGH`),
      env,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://www.getgridone.com/b/ABCDEFGH?email=invalid');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('POST verifies with the hashed token and shows the verified board state', async () => {
    const admin = verifyAdmin();
    const response = await verifyEndpoint.onRequestPost({
      request: new Request(verifyUrl('raw-token'), { method: 'POST', body: '' }),
      env,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://www.getgridone.com/b/ABCDEFGH?email=verified');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(admin.rpc).toHaveBeenCalledWith('gridone_verify_notification_subscription', {
      p_subscription_id: SUBSCRIPTION_ID,
      p_verification_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(admin.rpc.mock.calls[0][1].p_verification_token_hash).not.toBe('raw-token');
  });
});

describe('RFC 8058 one-click unsubscribe headers', () => {
  it('winner emails from the retry worker carry both List-Unsubscribe headers with the signed URL', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        delivery_id: 'd', lease_token: 'l', idempotency_key: 'k', notification_kind: 'winner', attempt_count: 1,
        recipient_email: 'w@example.test', subscription_id: SUBSCRIPTION_ID, milestone: 'Q1', side_digit: 1, top_digit: 2,
        participant_name: 'Winner One', board_title: 'Board', share_code: 'ABCDEFGH', side_team: 'CHI', top_team: 'GB',
      }], error: null })
      .mockResolvedValueOnce({ data: [{ status: 'sent' }], error: null });
    mocks.createClient.mockReturnValue({ rpc });
    const fetchMock = vi.fn(async (..._args: any[]) => new Response(JSON.stringify({ id: 'msg' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await retry({
      request: new Request('https://example.test/api/notifications/retry', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }),
      env,
    });
    expect(response.status).toBe(200);

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const listUnsubscribe = String(payload.headers['List-Unsubscribe']);
    expect(listUnsubscribe).toMatch(/^<https:\/\/www\.getgridone\.com\/api\/notifications\/unsubscribe\?[^>]+>$/);
    const url = new URL(listUnsubscribe.slice(1, -1));
    expect(url.searchParams.get('subscription')).toBe(SUBSCRIPTION_ID);
    expect(url.searchParams.get('board')).toBe('ABCDEFGH');
    const token = String(url.searchParams.get('token'));
    await expect(verifyUnsubscribeToken(env.NOTIFICATION_TOKEN_SECRET, SUBSCRIPTION_ID, token)).resolves.toBe(true);
    // The header and the in-body link are the same signed URL.
    expect(payload.html).toContain(`href="${url.toString()}"`);
  });

  it('the verification email carries no List-Unsubscribe header (nobody is subscribed yet)', async () => {
    const results = [
      { data: { contest_id: 'contest-1', board_title: 'Week One', contest: { id: 'contest-1', status: 'published' } }, error: null },
      { data: [{ claim_id: 'claim-1', should_send: true, is_throttled: false, subscription_id: 'subscription-1', participant_name: 'Parent One' }], error: null },
      { data: true, error: null },
    ];
    const chain: any = {};
    for (const method of ['select', 'eq', 'is', 'in', 'gte', 'ilike']) chain[method] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => results.shift());
    chain.single = chain.maybeSingle;
    chain.then = (resolve: any, reject: any) => Promise.resolve(results.shift()).then(resolve, reject);
    mocks.createClient.mockReturnValue({
      from: vi.fn(() => chain),
      rpc: vi.fn(async () => results.shift()),
    });
    const fetchMock = vi.fn(async (..._args: any[]) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await subscribe({
      request: new Request('https://example.test/api/boards/ABCDEFGH/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
        body: JSON.stringify({ participantId: '11111111-1111-4111-8111-111111111111', email: 'parent@example.com' }),
      }),
      env,
      params: { shareCode: 'ABCDEFGH' },
    });
    expect(response.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.html).toContain('/api/notifications/verify?');
    expect(JSON.stringify(payload.headers || {})).not.toMatch(/List-Unsubscribe/i);
  });
});
