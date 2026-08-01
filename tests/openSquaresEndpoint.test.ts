import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../functions/api/pools/[id]/open-squares';

const mocks = vi.hoisted(() => {
  const clients: any[] = [];
  const createClient = vi.fn(() => {
    const client = clients.shift();
    if (!client) throw new Error('No scripted Supabase client remains.');
    return client;
  });
  return { clients, createClient };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};
const boardId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const squares = Array.from({ length: 100 }, (_, index) => index < 94 ? [`Buyer ${index}`] : []);

const request = (body: unknown) => new Request(
  `https://example.test/api/pools/${boardId}/open-squares`,
  {
    method: 'POST',
    headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  },
);

const authClient = () => ({
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: ownerId } } })) },
});

const adminClient = ({
  revision = 4,
  rpcData = [{
    next_revision: 5,
    contest_updated_at: '2026-08-01T12:00:00.000Z',
    filled_count: 1,
  }],
  rpcError = null as null | { message: string },
} = {}) => {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: { id: boardId, revision }, error: null }));
  return {
    from: vi.fn(() => query),
    rpc: vi.fn(async () => ({ data: rpcData, error: rpcError })),
  };
};

beforeEach(() => {
  mocks.clients.length = 0;
  vi.clearAllMocks();
});

describe('post-publish open-square assignment endpoint', () => {
  it('normalizes a singleton name and calls the owner/revision RPC', async () => {
    const admin = adminClient();
    mocks.clients.push(authClient(), admin);
    const proposed = squares.map((cell) => [...cell]);
    proposed[94] = ['  Late Buyer  '];

    const response = await onRequestPost({
      request: request({ revision: 4, squares: proposed }),
      env,
      params: { id: boardId },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      revision: 5,
      updatedAt: '2026-08-01T12:00:00.000Z',
      filledCount: 1,
    });
    expect(admin.rpc).toHaveBeenCalledWith('gridone_fill_open_squares', {
      p_contest_id: boardId,
      p_owner_id: ownerId,
      p_expected_revision: 4,
      p_normalized_names: expect.arrayContaining([['Late Buyer']]),
    });
  });

  it('rejects ambiguous cells before any database work', async () => {
    mocks.clients.push(authClient());
    const proposed = squares.map((cell) => [...cell]);
    proposed[94] = ['One', 'Two'];

    const response = await onRequestPost({
      request: request({ revision: 4, squares: proposed }),
      env,
      params: { id: boardId },
    });

    expect(response.status).toBe(400);
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  it('returns a revision conflict before invoking the mutation RPC', async () => {
    const admin = adminClient({ revision: 6 });
    mocks.clients.push(authClient(), admin);

    const response = await onRequestPost({
      request: request({ revision: 4, squares }),
      env,
      params: { id: boardId },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'REVISION_CONFLICT',
      currentRevision: 6,
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['This board is frozen at kickoff', 'KICKOFF_FROZEN'],
    ['Occupied squares cannot be changed or cleared', 'BOARD_LOCKED'],
  ])('maps the database guard %s to a stable conflict code', async (message, code) => {
    const admin = adminClient({ rpcError: { message } });
    mocks.clients.push(authClient(), admin);

    const response = await onRequestPost({
      request: request({ revision: 4, squares }),
      env,
      params: { id: boardId },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code });
  });
});
