import { webcrypto } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as subscribe } from '../functions/api/boards/[shareCode]/subscribe';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

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

const acceptedBody = JSON.stringify({
  accepted: true,
  message: 'If this address needs verification, check your inbox. Any already verified address remains active.',
});

type Claim = {
  claim_id?: string | null;
  should_send: boolean;
  is_throttled: boolean;
  retry_after_seconds?: number | null;
  subscription_id?: string | null;
  participant_name?: string | null;
};

const makeAdmin = (claim: Claim, completionError: unknown = null) => {
  const operations: string[] = [];
  const rpc = vi.fn(async (name: string) => {
    operations.push(`rpc:${name}`);
    if (name === 'gridone_claim_notification_send') return { data: [claim], error: null };
    if (name === 'gridone_complete_notification_send') {
      return { data: true, error: completionError };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({
      data: {
        contest_id: 'contest-1',
        board_title: 'Week One',
        contest: { id: 'contest-1', status: 'published' },
      },
      error: null,
    })),
  };
  return {
    operations,
    rpc,
    from: vi.fn(() => chain),
  };
};

const request = (
  participantId = '11111111-1111-4111-8111-111111111111',
  email = 'parent@example.com',
  headers: Record<string, string> = {},
) => {
  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '203.0.113.10',
    ...headers,
  });
  if (headers['CF-Connecting-IP'] === '__omit__') requestHeaders.delete('CF-Connecting-IP');
  return new Request('https://example.test/api/boards/ABCDEFGH/subscribe', {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({ participantId, email }),
  });
};

beforeAll(() => {
  Object.assign(globalThis.crypto, {
    randomUUID: webcrypto.randomUUID.bind(webcrypto),
  });
  Object.assign(globalThis.crypto.subtle, {
    importKey: webcrypto.subtle.importKey.bind(webcrypto.subtle),
    sign: webcrypto.subtle.sign.bind(webcrypto.subtle),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe.sequential('subscribe abuse boundary', () => {
  it('returns byte-identical accepted responses for every non-throttled state', async () => {
    const claims: Claim[] = [
      {
        claim_id: 'claim-new',
        should_send: true,
        is_throttled: false,
        subscription_id: 'subscription-new',
        participant_name: 'Parent One',
      },
      { should_send: false, is_throttled: false },
      { should_send: false, is_throttled: false, subscription_id: 'subscription-verified' },
      {
        claim_id: 'claim-change',
        should_send: true,
        is_throttled: false,
        subscription_id: 'subscription-change',
        participant_name: 'Parent One',
      },
      {
        claim_id: 'claim-provider-failure',
        should_send: true,
        is_throttled: false,
        subscription_id: 'subscription-provider-failure',
        participant_name: 'Parent One',
      },
    ];
    const admins = claims.map(claim => makeAdmin(claim));
    mocks.createClient.mockImplementation(() => admins.shift());
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ id: 'email-new' }))
      .mockResolvedValueOnce(Response.json({ id: 'email-change' }))
      .mockResolvedValueOnce(Response.json({ message: 'rejected' }, { status: 503 }));
    vi.stubGlobal('fetch', providerFetch);

    const responses = await Promise.all([
      subscribe({ request: request(), env, params: { shareCode: 'ABCDEFGH' } }),
      subscribe({
        request: request('22222222-2222-4222-8222-222222222222'),
        env,
        params: { shareCode: 'ABCDEFGH' },
      }),
      subscribe({ request: request(), env, params: { shareCode: 'ABCDEFGH' } }),
      subscribe({
        request: request(undefined, 'new@example.com'),
        env,
        params: { shareCode: 'ABCDEFGH' },
      }),
      subscribe({
        request: request(undefined, 'failure@example.com'),
        env,
        params: { shareCode: 'ABCDEFGH' },
      }),
    ]);

    expect(responses.map(response => response.status)).toEqual([202, 202, 202, 202, 202]);
    expect(await Promise.all(responses.map(response => response.text()))).toEqual(
      Array.from({ length: 5 }, () => acceptedBody),
    );
    expect(providerFetch).toHaveBeenCalledTimes(3);
  });

  it('claims before sending and records provider completion', async () => {
    const admin = makeAdmin({
      claim_id: 'claim-1',
      should_send: true,
      is_throttled: false,
      subscription_id: 'subscription-1',
      participant_name: 'Parent One',
    });
    mocks.createClient.mockReturnValue(admin);
    vi.stubGlobal('fetch', vi.fn(async () => {
      admin.operations.push('fetch:resend');
      return Response.json({ id: 'email-1' });
    }));

    const response = await subscribe({ request: request(), env, params: { shareCode: 'ABCDEFGH' } });

    expect(response.status).toBe(202);
    expect(admin.operations).toEqual([
      'rpc:gridone_claim_notification_send',
      'fetch:resend',
      'rpc:gridone_complete_notification_send',
    ]);
    expect(admin.rpc).toHaveBeenLastCalledWith('gridone_complete_notification_send', expect.objectContaining({
      p_claim_id: 'claim-1',
      p_outcome: 'sent',
      p_provider_message_id: 'email-1',
    }));
  });

  it('never calls the provider when a claim is throttled', async () => {
    const admin = makeAdmin({
      should_send: false,
      is_throttled: true,
      retry_after_seconds: 317,
    });
    mocks.createClient.mockReturnValue(admin);
    const providerFetch = vi.fn();
    vi.stubGlobal('fetch', providerFetch);

    const response = await subscribe({ request: request(), env, params: { shareCode: 'ABCDEFGH' } });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('317');
    expect(await response.json()).toEqual({
      error: 'Too many verification requests. Try again later.',
    });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('uses only CF-Connecting-IP and ignores a spoofed forwarded address', async () => {
    const admin = makeAdmin({ should_send: false, is_throttled: false });
    mocks.createClient.mockReturnValue(admin);
    vi.stubGlobal('fetch', vi.fn());

    await subscribe({
      request: request(undefined, undefined, {
        'CF-Connecting-IP': '2001:db8::5',
        'X-Forwarded-For': '198.51.100.99',
      }),
      env,
      params: { shareCode: 'ABCDEFGH' },
    });

    expect(admin.rpc).toHaveBeenCalledWith('gridone_claim_notification_send', expect.objectContaining({
      p_client_ip: '2001:db8::5',
    }));
  });

  it('maps a malformed participant reference to the non-enumerating accepted path', async () => {
    const admin = makeAdmin({ should_send: false, is_throttled: false });
    mocks.createClient.mockReturnValue(admin);
    vi.stubGlobal('fetch', vi.fn());

    const response = await subscribe({
      request: request('not-a-uuid'),
      env,
      params: { shareCode: 'ABCDEFGH' },
    });

    expect(response.status).toBe(202);
    expect(await response.text()).toBe(acceptedBody);
    expect(admin.rpc).toHaveBeenCalledWith('gridone_claim_notification_send', expect.objectContaining({
      p_requested_participant_id: '00000000-0000-4000-8000-000000000000',
    }));
  });

  it.each([
    ['missing', { 'CF-Connecting-IP': '__omit__' }],
    ['invalid', { 'CF-Connecting-IP': 'not-an-ip' }],
    ['forwarded-only', { 'CF-Connecting-IP': '', 'X-Forwarded-For': '203.0.113.9' }],
  ])('fails closed for a %s Cloudflare client address', async (_label, headers) => {
    const response = await subscribe({
      request: request(undefined, undefined, headers),
      env,
      params: { shareCode: 'ABCDEFGH' },
    });

    expect(response.status).toBe(503);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
