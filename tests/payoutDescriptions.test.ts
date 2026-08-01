import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, fetchScheduledGameByIdMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  fetchScheduledGameByIdMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('../functions/_lib/espnNfl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../functions/_lib/espnNfl')>();
  return {
    ...actual,
    fetchScheduledGameById: fetchScheduledGameByIdMock,
  };
});

import { validatePayoutDescriptions } from '../functions/_lib/payoutDescriptions';
import { onRequestPost } from '../functions/api/pools';
import { onRequestGet, onRequestPatch } from '../functions/api/pools/[id]';

const BOARD_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  PUBLIC_SITE_URL: 'https://getgridone.com',
};
const scheduledGame = {
  id: '401772510',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  state: 'pre' as const,
  season: 2026,
  week: 1,
  awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
  homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
};

const ownerQuery = (revision = 3, data: unknown = { revision }) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
});

const authenticatedClient = (query = ownerQuery()) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: OWNER_ID } },
      error: null,
    }),
  },
  from: vi.fn().mockReturnValue(query),
});

const patchRequest = (body: unknown, authenticated = true) => new Request(
  `https://getgridone.com/api/pools/${BOARD_ID}`,
  {
    method: 'PATCH',
    headers: {
      ...(authenticated ? { Authorization: 'Bearer token' } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  },
);

describe('payout description validation', () => {
  it('normalizes optional free text and removes blank values', () => {
    expect(validatePayoutDescriptions({
      Q1: '  Winner gets bragging rights  ',
      HALF: '',
      notes: '  Organizer rules apply. ',
    })).toEqual({
      Q1: 'Winner gets bragging rights',
      notes: 'Organizer rules apply.',
    });
  });

  it.each([
    [null, /must be an object/i],
    [[], /must be an object/i],
    [{ Q2: 'Unsupported key' }, /unknown payout description field/i],
    [{ Q1: 50 }, /plain text only/i],
    [{ Q1: 'x'.repeat(121) }, /120 characters/i],
    [{ notes: 'x'.repeat(281) }, /280 characters/i],
    [{ FINAL: 'HTTPS://example.com/rules' }, /cannot contain URLs/i],
  ])('rejects invalid descriptions %#', (value, message) => {
    expect(() => validatePayoutDescriptions(value)).toThrow(message);
  });
});

describe('PATCH /api/pools/:id payout descriptions', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('requires an authenticated organizer', async () => {
    const response = await onRequestPatch({
      request: patchRequest({ revision: 3, payoutDescriptions: {} }, false),
      env,
      params: { id: BOARD_ID },
    });

    expect(response.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('returns not found when the authenticated user does not own the board', async () => {
    createClientMock.mockReturnValue(authenticatedClient(ownerQuery(3, null)));
    const response = await onRequestPatch({
      request: patchRequest({ revision: 3, payoutDescriptions: {} }),
      env,
      params: { id: BOARD_ID },
    });

    expect(response.status).toBe(404);
  });

  it('rejects a non-object request body', async () => {
    createClientMock.mockReturnValue(authenticatedClient());
    const response = await onRequestPatch({
      request: patchRequest([]),
      env,
      params: { id: BOARD_ID },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid request body.' });
  });

  it('rejects invalid descriptions before invoking the write RPC', async () => {
    const client = authenticatedClient();
    createClientMock.mockReturnValue(client);
    const response = await onRequestPatch({
      request: patchRequest({
        revision: 3,
        payoutDescriptions: { notes: 'Rules: http://example.com' },
      }),
      env,
      params: { id: BOARD_ID },
    });

    expect(response.status).toBe(400);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('returns the current revision without writing on a stale edit', async () => {
    createClientMock.mockReturnValue(authenticatedClient(ownerQuery(4)));
    const response = await onRequestPatch({
      request: patchRequest({ revision: 3, payoutDescriptions: { Q1: 'A pie' } }),
      env,
      params: { id: BOARD_ID },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'REVISION_CONFLICT',
      currentRevision: 4,
    });
  });

  it('writes normalized descriptions through the owner-bound service RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        next_revision: 4,
        contest_updated_at: '2026-08-01T18:00:00.000Z',
        payout_descriptions: { Q1: 'A pie', notes: 'Organizer rules apply.' },
      }],
      error: null,
    });
    createClientMock.mockImplementation((_url: string, key: string) => (
      key === 'service-role' ? { rpc } : authenticatedClient()
    ));
    const response = await onRequestPatch({
      request: patchRequest({
        revision: 3,
        payoutDescriptions: { Q1: '  A pie ', HALF: ' ', notes: ' Organizer rules apply. ' },
      }),
      env,
      params: { id: BOARD_ID },
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('gridone_update_payout_descriptions', {
      p_contest_id: BOARD_ID,
      p_owner_id: OWNER_ID,
      p_expected_revision: 3,
      p_payout_descriptions: { Q1: 'A pie', notes: 'Organizer rules apply.' },
    });
    await expect(response.json()).resolves.toMatchObject({
      revision: 4,
      payoutDescriptions: { Q1: 'A pie', notes: 'Organizer rules apply.' },
    });
  });
});

describe('board creation payout descriptions', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    fetchScheduledGameByIdMock.mockReset();
  });

  it('stores descriptions separately and does not seed legacy payout labels', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: BOARD_ID, share_code: 'ABCDEFGH', revision: 1 },
          error: null,
        }),
      }),
    });
    createClientMock.mockReturnValue({
      ...authenticatedClient(),
      from: vi.fn().mockReturnValue({ insert }),
    });
    fetchScheduledGameByIdMock.mockResolvedValue(scheduledGame);
    const response = await onRequestPost({
      request: new Request('https://getgridone.com/api/pools', {
        method: 'POST',
        headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: {
            title: 'Week 1 board',
            gameExternalId: scheduledGame.id,
            payouts: { Q1: 125 },
            payoutDescriptions: { FINAL: 'Winner gets the trophy' },
          },
          board: { squares: Array.from({ length: 100 }, () => []) },
        }),
      }),
      env,
    });

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      payout_labels: {},
      payout_descriptions: { FINAL: 'Winner gets the trophy' },
    }));
    expect(insert.mock.calls[0][0].settings).not.toHaveProperty('payouts');
  });
});

describe('public payout description projection', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('returns descriptions from the single public snapshot query', async () => {
    const select = vi.fn().mockReturnThis();
    const query = {
      select,
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          share_code: 'ABCDEFGH',
          revision: 4,
          board_title: 'Week 1 board',
          matchup: {},
          board: { squares: Array.from({ length: 100 }, () => []) },
          score: null,
          winner_history: [],
          pending_milestones: [],
          payout_labels: {},
          payout_descriptions: { HALF: 'Winner gets the trophy' },
          score_test_mode: false,
          published_at: '2026-08-01T18:00:00.000Z',
          updated_at: '2026-08-01T18:00:00.000Z',
          contest: { id: BOARD_ID, status: 'published' },
        },
        error: null,
      }),
    };
    createClientMock.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    const response = await onRequestGet({
      request: new Request('https://getgridone.com/api/pools/ABCDEFGH'),
      env,
      params: { id: 'ABCDEFGH' },
    });

    expect(response.status).toBe(200);
    expect(select).toHaveBeenCalledWith(expect.stringContaining('payout_descriptions'));
    await expect(response.json()).resolves.toMatchObject({
      payoutDescriptions: { HALF: 'Winner gets the trophy' },
    });
  });
});
