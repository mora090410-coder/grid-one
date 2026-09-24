import { createHash, createHmac, webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

import { onRequestPost as retryNotifications } from '../functions/api/notifications/retry';
import { verifyUnsubscribeToken } from '../functions/_lib/winnerNotifications';
import { escapeHtml, hmacSha256Hex, sha256Hex, timingSafeEqual } from '../functions/_lib/crypto';
import { authRejectedToken, currentSeason, readJsonObject, runBounded } from '../functions/_lib/http';
import { hashFamilyToken } from '../functions/_lib/familyAccess';
import { hashGuestCredential } from '../functions/_lib/guestInviteCredentials';
import { allowanceErrorMessage } from '../functions/_lib/pricingTiers';
import { PRICING } from '../src/features/homepage/pricing';

beforeAll(() => {
  // tests/setup.ts installs a toy digest; these checks need real SHA-256 and HMAC.
  Object.assign(globalThis.crypto.subtle, {
    digest: webcrypto.subtle.digest.bind(webcrypto.subtle),
    importKey: webcrypto.subtle.importKey.bind(webcrypto.subtle),
    sign: webcrypto.subtle.sign.bind(webcrypto.subtle),
  });
});

describe('one unsubscribe signer', () => {
  it('verifies the token the retry worker puts in a winner email', async () => {
    const subscriptionId = '30000000-0000-4000-8000-000000000001';
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        delivery_id: 'd', lease_token: 'l', idempotency_key: 'k', notification_kind: 'winner', attempt_count: 1,
        recipient_email: 'w@example.test', subscription_id: subscriptionId, milestone: 'Q1', side_digit: 1, top_digit: 2,
        participant_name: 'Win <One>', board_title: 'Board', share_code: 'ABCDEFGH', side_team: 'CHI', top_team: 'GB',
      }], error: null })
      .mockResolvedValueOnce({ data: [{ status: 'sent' }], error: null });
    mocks.createClient.mockReturnValue({ rpc });
    const fetchMock = vi.fn(async (..._args: any[]) => new Response(JSON.stringify({ id: 'msg' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = {
      CRON_SECRET: 'cron', VITE_SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc',
      EMAIL_PROVIDER_API_KEY: 'email', EMAIL_FROM: 'GridOne <a@b.c>', NOTIFICATION_TOKEN_SECRET: 'notification-secret',
      PUBLIC_SITE_URL: 'https://www.getgridone.com',
    };
    const response = await retryNotifications({ request: new Request('https://x.test/api/notifications/retry', { method: 'POST', headers: { Authorization: 'Bearer cron' } }), env });
    expect(await response.json()).toMatchObject({ sent: 1 });
    const html = JSON.parse(String(fetchMock.mock.calls[0][1].body)).html as string;
    expect(html).toContain('Win &lt;One&gt;');
    const token = html.match(/[?&]token=([a-f0-9]+)/)?.[1];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    await expect(verifyUnsubscribeToken(env.NOTIFICATION_TOKEN_SECRET, subscriptionId, token!)).resolves.toBe(true);
    await expect(verifyUnsubscribeToken('other-secret', subscriptionId, token!)).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('shared crypto helpers', () => {
  it('match Node SHA-256 and HMAC output byte for byte', async () => {
    const expected = createHash('sha256').update('héllo token').digest('hex');
    await expect(sha256Hex('héllo token')).resolves.toBe(expected);
    await expect(hashFamilyToken('héllo token')).resolves.toBe(expected);
    await expect(hashGuestCredential('héllo token')).resolves.toBe(expected);
    await expect(hmacSha256Hex('secret', 'value')).resolves.toBe(createHmac('sha256', 'secret').update('value').digest('hex'));
  });

  it('compares strings without accepting prefixes', () => {
    expect(timingSafeEqual('Bearer abc', 'Bearer abc')).toBe(true);
    expect(timingSafeEqual('Bearer abc', 'Bearer ab')).toBe(false);
    expect(timingSafeEqual('', 'x')).toBe(false);
  });

  it('escapes HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('shared http helpers', () => {
  const body = (text: string, headers: Record<string, string> = {}) => new Request('https://x.test', { method: 'POST', body: text, headers });

  it('reads bounded JSON objects and rejects everything else', async () => {
    await expect(readJsonObject(body('{"a":1}'), 100)).resolves.toEqual({ a: 1 });
    for (const text of ['', 'null', '[]', '"x"', '{bad']) {
      const result = await readJsonObject(body(text), 100);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(400);
    }
    const tooLarge = await readJsonObject(body(JSON.stringify({ a: 'x'.repeat(200) })), 100);
    expect((tooLarge as Response).status).toBe(413);
    const declared = await readJsonObject(body('{}', { 'Content-Length': '5000' }), 100);
    expect((declared as Response).status).toBe(413);
  });

  it('treats only an answered 4xx (not 429) as a rejected token', () => {
    expect(authRejectedToken({ status: 401, name: 'AuthApiError' })).toBe(true);
    expect(authRejectedToken({ status: 403, name: 'AuthApiError' })).toBe(true);
    expect(authRejectedToken({ status: 429, name: 'AuthApiError' })).toBe(false);
    expect(authRejectedToken({ status: 502, name: 'AuthRetryableFetchError' })).toBe(false);
    expect(authRejectedToken({ status: 0, name: 'AuthRetryableFetchError' })).toBe(false);
    expect(authRejectedToken({ name: 'TypeError' })).toBe(false);
  });

  it('defaults the season to 2026 and honors GRIDONE_SEASON', () => {
    expect(currentSeason({})).toBe(2026);
    expect(currentSeason({ GRIDONE_SEASON: '2027' })).toBe(2027);
    expect(currentSeason({ GRIDONE_SEASON: 'soon' })).toBe(2026);
  });

  it('never runs more operations at once than the limit', async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    await runBounded([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      seen.push(value);
      active -= 1;
    });
    expect(peak).toBe(3);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('allowance copy matches the pricing ladder', () => {
  it('uses the board counts written in the homepage pricing', () => {
    const detail = (id: string) => PRICING.find((tier) => tier.id === id)!.detail;
    expect(detail('free')).toContain('1 published board');
    expect(allowanceErrorMessage('ALLOWANCE_EXHAUSTED', 'free')).toContain('1 board per season');
    expect(detail('gameday')).toContain('up to 5 published boards');
    expect(allowanceErrorMessage('ALLOWANCE_EXHAUSTED', 'gameday')).toContain('all 5 boards');
    expect(detail('org')).toContain('up to 50 published boards');
    expect(allowanceErrorMessage('ALLOWANCE_EXHAUSTED', 'org')).toContain('all 50 boards');
  });
});
