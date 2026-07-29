import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from '../functions/api/pools/[id]/score';

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

vi.mock('../functions/_lib/winnerNotifications', () => ({
  observeMilestones: vi.fn(),
}));

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

const authClient = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: 'owner-1' } } })),
  },
};

const adminClient = (contest: Record<string, unknown>) => {
  const tables: string[] = [];
  const from = vi.fn((table: string) => {
    tables.push(table);
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      in: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({
        data: table === 'public_board_snapshots'
          ? { contest_id: contest.id, contest }
          : contest,
        error: null,
      })),
    };
    return chain;
  });
  return {
    from,
    rpc: vi.fn(),
    tables,
  };
};

beforeEach(() => {
  mocks.clients.length = 0;
  vi.clearAllMocks();
});

describe.sequential('automatic score service activation boundary', () => {
  it('rejects an unactivated organizer board before reading score state', async () => {
    const admin = adminClient({
      id: '11111111-1111-4111-8111-111111111111',
      owner_id: 'owner-1',
      status: 'draft',
      board_activations: [],
    });
    mocks.clients.push(admin, authClient);

    const response = await onRequestGet({
      request: new Request(
        'https://example.test/api/pools/11111111-1111-4111-8111-111111111111/score',
        { headers: { Authorization: 'Bearer owner-token' } },
      ),
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Unlock this board'),
    });
    expect(admin.tables).toEqual(['contests']);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('does not let an unactivated published share code bypass the service gate', async () => {
    const admin = adminClient({
      id: 'board-1',
      owner_id: 'owner-1',
      status: 'published',
      board_activations: [],
    });
    mocks.clients.push(admin);

    const response = await onRequestGet({
      request: new Request('https://example.test/api/pools/ABCDEFGH/score'),
      env,
      params: { id: 'ABCDEFGH' },
    });

    expect(response.status).toBe(402);
    expect(admin.tables).toEqual(['public_board_snapshots']);
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});
