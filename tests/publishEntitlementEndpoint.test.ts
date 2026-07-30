import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as publishBoard } from '../functions/api/pools/[id]/publish';

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
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

const request = () => new Request(
  'https://example.test/api/pools/board-1/publish',
  {
    method: 'POST',
    headers: { Authorization: 'Bearer access-token' },
  },
);

const authClient = ({
  verified = true,
}: {
  verified?: boolean;
} = {}) => ({
  auth: {
    getUser: vi.fn(async () => ({
      data: {
        user: {
          id: 'user-1',
          email: 'organizer@example.test',
          email_confirmed_at: verified
            ? '2026-07-29T12:00:00.000Z'
            : null,
        },
      },
    })),
  },
});

const contest = {
  id: 'board-1',
  share_code: 'ABCDEFGH',
  owner_id: 'user-1',
  title: 'Riverside Ravens',
  revision: 4,
  settings: {
    leftName: 'Chicago Bears',
    leftAbbr: 'CHI',
    topName: 'Green Bay Packers',
    topAbbr: 'GB',
    dates: '2026-09-13',
  },
  board_data: {
    bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    oppAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    squares: Array.from({ length: 100 }, (_, index) => [`Buyer ${index + 1}`]),
  },
  published_at: null,
  side_axis: null,
  top_axis: null,
  side_team_name: 'Chicago Bears',
  side_team_abbr: 'CHI',
  top_team_name: 'Green Bay Packers',
  top_team_abbr: 'GB',
  game_external_id: '401772510',
  game_starts_at: '2026-09-13T17:00:00.000Z',
  payout_labels: null,
};

const adminClient = ({
  rpcData = [{
    share_code: 'ABCDEFGH',
    next_revision: 5,
    tier: 'free',
    used: 1,
    allowance: 1,
  }],
  rpcError = null as null | { message: string },
}: {
  rpcData?: any;
  rpcError?: null | { message: string };
} = {}) => {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({
    data: contest,
    error: null,
  }));
  return {
    from: vi.fn(() => chain),
    rpc: vi.fn(async () => ({
      data: rpcData,
      error: rpcError,
    })),
    query: chain,
  };
};

beforeEach(() => {
  mocks.clients.length = 0;
  vi.clearAllMocks();
});

describe.sequential('publish entitlement boundary', () => {
  it('rejects an unverified email before reading or writing board data', async () => {
    mocks.clients.push(authClient({ verified: false }));

    const response = await publishBoard({
      request: request(),
      env,
      params: { id: 'board-1' },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Verify your email before publishing your free board.',
    });
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  it('publishes through the server RPC without an activation precheck', async () => {
    const admin = adminClient();
    mocks.clients.push(authClient(), admin);

    const response = await publishBoard({
      request: request(),
      env,
      params: { id: 'board-1' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      published: true,
      shareCode: 'ABCDEFGH',
      viewerUrl: '/b/ABCDEFGH',
      revision: 5,
      tier: 'free',
      used: 1,
      allowance: 1,
    });
    expect(admin.query.select).toHaveBeenCalledWith(
      expect.not.stringContaining('board_activations'),
    );
    expect(admin.rpc).toHaveBeenCalledWith(
      'gridone_publish_board',
      expect.objectContaining({
        p_contest_id: 'board-1',
        p_owner_id: 'user-1',
        p_expected_revision: 4,
      }),
    );
  });

  it.each([
    [
      'free',
      1,
      1,
      'gameday',
      'Your first board is live. Choose Game Day to publish another.',
    ],
    [
      'gameday',
      5,
      5,
      'org',
      'Your Game Day plan has published all 5 boards for this season.',
    ],
  ] as const)(
    'returns the server-owned %s allowance edge',
    async (tier, used, allowance, upgradeTo, error) => {
      const admin = adminClient({
        rpcData: null,
        rpcError: {
          message: `PUBLISH_ALLOWANCE_EXHAUSTED:${tier}:${used}:${allowance}`,
        },
      });
      mocks.clients.push(authClient(), admin);

      const response = await publishBoard({
        request: request(),
        env,
        params: { id: 'board-1' },
      });

      expect(response.status).toBe(402);
      await expect(response.json()).resolves.toEqual({
        code: 'PUBLISH_ALLOWANCE_EXHAUSTED',
        error,
        tier,
        used,
        allowance,
        upgradeTo,
      });
    },
  );
});
