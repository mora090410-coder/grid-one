import { webcrypto } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  observeMilestones,
  verifyUnsubscribeToken,
} from '../functions/_lib/winnerNotifications';
import { onRequestGet as unsubscribe } from '../functions/api/notifications/unsubscribe';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  NOTIFICATION_TOKEN_SECRET: 'notification-secret',
  PUBLIC_SITE_URL: 'https://www.getgridone.com',
};

const encodeHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

const sign = async (subscriptionId: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.NOTIFICATION_TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return encodeHex(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(subscriptionId),
  ));
};

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

describe('winner notification outbox and unsubscribe flow', () => {
  it('observes a promoted snapshot through one database RPC without sending email inline', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        winner_history: [{ milestone: 'Q1', participantName: 'Parent One' }],
        pending_milestones: [],
        newly_confirmed_resolution_ids: ['resolution-1'],
      }],
      error: null,
    });

    await expect(observeMilestones({ rpc }, 'contest-1', { id: 'snapshot-1' })).resolves.toEqual({
      winnerHistory: [{ milestone: 'Q1', participantName: 'Parent One' }],
      pendingMilestones: [],
      newlyConfirmedResolutionIds: ['resolution-1'],
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('gridone_observe_milestones', {
      p_contest_id: 'contest-1',
      p_snapshot_id: 'snapshot-1',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts the signed worker-generated token and unsubscribes the exact subscription', async () => {
    const subscriptionId = '11111111-1111-4111-8111-111111111111';
    const token = await sign(subscriptionId);
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: subscriptionId },
      error: null,
    });
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    mocks.createClient.mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    });

    const response = await unsubscribe({
      request: new Request(
        `https://www.getgridone.com/api/notifications/unsubscribe?subscription=${subscriptionId}&token=${token}&board=ABCDEFGH`,
      ),
      env,
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://www.getgridone.com/b/ABCDEFGH?email=unsubscribed',
    );
    expect(query.eq).toHaveBeenCalledWith('id', subscriptionId);
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'unsubscribed',
      unsubscribed_at: expect.any(String),
    }));
  });

  it('rejects a modified unsubscribe token without touching the database', async () => {
    const subscriptionId = '11111111-1111-4111-8111-111111111111';
    const token = await sign(subscriptionId);

    await expect(verifyUnsubscribeToken(
      env.NOTIFICATION_TOKEN_SECRET,
      subscriptionId,
      `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`,
    )).resolves.toBe(false);

    const response = await unsubscribe({
      request: new Request(
        `https://www.getgridone.com/api/notifications/unsubscribe?subscription=${subscriptionId}&token=bad&board=ABCDEFGH`,
      ),
      env,
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://www.getgridone.com/b/ABCDEFGH?email=unsubscribe-invalid',
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
