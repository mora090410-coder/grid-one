import { webcrypto } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyProviderResponse,
  onRequestPost,
} from '../functions/api/notifications/retry';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

const env = {
  CRON_SECRET: 'cron-secret',
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  EMAIL_PROVIDER_API_KEY: 'email-key',
  EMAIL_FROM: 'GridOne <updates@getgridone.com>',
  NOTIFICATION_TOKEN_SECRET: 'notification-secret',
  PUBLIC_SITE_URL: 'https://www.getgridone.com',
};

const claimedDelivery = {
  delivery_id: '10000000-0000-4000-8000-000000000001',
  lease_token: '20000000-0000-4000-8000-000000000001',
  idempotency_key: 'winner:resolution:subscription',
  notification_kind: 'winner',
  attempt_count: 1,
  recipient_email: 'winner@example.test',
  subscription_id: '30000000-0000-4000-8000-000000000001',
  milestone: 'Q2',
  side_digit: 7,
  top_digit: 3,
  participant_name: 'Winner One',
  board_title: 'Week One',
  share_code: 'ABCDEFGH',
  side_team: 'CHI',
  top_team: 'GB',
};

const request = (authorization = `Bearer ${env.CRON_SECRET}`) => new Request(
  'https://example.test/api/notifications/retry',
  {
    method: 'POST',
    headers: { Authorization: authorization },
  },
);

beforeAll(() => {
  Object.assign(globalThis.crypto.subtle, {
    importKey: webcrypto.subtle.importKey.bind(webcrypto.subtle),
    sign: webcrypto.subtle.sign.bind(webcrypto.subtle),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('notification retry provider classification', () => {
  it('treats provider 4xx responses as permanent', () => {
    expect(classifyProviderResponse(422, { message: 'Invalid recipient' })).toEqual({
      outcome: 'permanent',
      error: 'Invalid recipient',
    });
  });

  it('treats provider 5xx responses as transient', () => {
    expect(classifyProviderResponse(503, { message: 'Provider unavailable' })).toEqual({
      outcome: 'transient',
      error: 'Provider unavailable',
    });
  });

  it('treats provider throttling and request timeouts as transient', () => {
    expect(classifyProviderResponse(429, { message: 'Rate limited' })).toEqual({
      outcome: 'transient',
      error: 'Rate limited',
    });
    expect(classifyProviderResponse(408, { message: 'Request timeout' })).toEqual({
      outcome: 'transient',
      error: 'Request timeout',
    });
  });
});

describe.sequential('notification retry worker', () => {
  it('requires the exact cron bearer secret before creating a service client', async () => {
    const response = await onRequestPost({ request: request('Bearer wrong'), env });

    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('claims a bounded batch and completes a hard provider failure permanently', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [claimedDelivery], error: null })
      .mockResolvedValueOnce({
        data: [{ status: 'failed_permanent', attempt_count: 1, next_attempt_at: null }],
        error: null,
      });
    mocks.createClient.mockReturnValue({ rpc });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ message: 'Invalid recipient' }),
      { status: 422, statusText: 'Unprocessable Entity' },
    )));

    const response = await onRequestPost({ request: request(), env });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 1,
      sent: 0,
      retrying: 0,
      terminal: 1,
      completionErrors: 0,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, 'gridone_claim_notification_deliveries', {
      p_limit: 20,
      p_lease_seconds: 120,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'gridone_complete_notification_delivery', {
      p_delivery_id: claimedDelivery.delivery_id,
      p_lease_token: claimedDelivery.lease_token,
      p_outcome: 'permanent',
      p_provider_message_id: null,
      p_error: 'Invalid recipient',
    });
  });

  it('uses the delivery idempotency key and leaves backoff scheduling to PostgreSQL', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [claimedDelivery], error: null })
      .mockResolvedValueOnce({
        data: [{
          status: 'failed',
          attempt_count: 1,
          next_attempt_at: '2026-09-13T20:01:00.000Z',
        }],
        error: null,
      });
    mocks.createClient.mockReturnValue({ rpc });
    const providerFetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(
      JSON.stringify({ message: 'Provider unavailable' }),
      { status: 503, statusText: 'Service Unavailable' },
    ));
    vi.stubGlobal('fetch', providerFetch);

    const response = await onRequestPost({ request: request(), env });

    expect(response.status).toBe(200);
    expect((await response.json()).retrying).toBe(1);
    expect(new Headers(providerFetch.mock.calls[0][1]?.headers).get('Idempotency-Key'))
      .toBe(claimedDelivery.idempotency_key);
    expect(rpc).toHaveBeenNthCalledWith(2, 'gridone_complete_notification_delivery', {
      p_delivery_id: claimedDelivery.delivery_id,
      p_lease_token: claimedDelivery.lease_token,
      p_outcome: 'transient',
      p_provider_message_id: null,
      p_error: 'Provider unavailable',
    });
  });

  it('records provider success with the provider message id', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [claimedDelivery], error: null })
      .mockResolvedValueOnce({
        data: [{ status: 'sent', attempt_count: 1, next_attempt_at: null }],
        error: null,
      });
    mocks.createClient.mockReturnValue({ rpc });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ id: 'email_123' }),
      { status: 200 },
    )));

    const response = await onRequestPost({ request: request(), env });

    expect(response.status).toBe(200);
    expect((await response.json()).sent).toBe(1);
    expect(rpc).toHaveBeenNthCalledWith(2, 'gridone_complete_notification_delivery', {
      p_delivery_id: claimedDelivery.delivery_id,
      p_lease_token: claimedDelivery.lease_token,
      p_outcome: 'sent',
      p_provider_message_id: 'email_123',
      p_error: null,
    });
  });

  it('clearly tells the previous recipient that a settled result was corrected', async () => {
    const correctionDelivery = {
      ...claimedDelivery,
      notification_kind: 'correction_previous',
      idempotency_key: 'correction:resolution:previous:subscription',
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [correctionDelivery], error: null })
      .mockResolvedValueOnce({
        data: [{ status: 'sent', attempt_count: 1, next_attempt_at: null }],
        error: null,
      });
    mocks.createClient.mockReturnValue({ rpc });
    const providerFetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ id: 'email_correction' }), { status: 200 }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await onRequestPost({ request: request(), env });
    const payload = JSON.parse(String(providerFetch.mock.calls[0][1]?.body));

    expect(response.status).toBe(200);
    expect(payload.subject).toBe('Correction to the halftime result on Week One');
    expect(payload.html).toContain('The halftime result was corrected');
    expect(payload.html).toContain('The corrected winner is Winner One.');
  });
});
