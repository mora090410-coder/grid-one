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

const request = (body?: unknown) => new Request(
  'https://example.test/api/pools/board-1/publish',
  {
    method: 'POST',
    headers: { Authorization: 'Bearer access-token' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
    leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
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
  contestData = contest,
  rpcData = [{
    share_code: 'ABCDEFGH',
    next_revision: 5,
    tier: 'free',
    used: 1,
    allowance: 1,
  }],
  rpcError = null as null | { message: string },
}: {
  contestData?: any;
  rpcData?: any;
  rpcError?: null | { message: string };
} = {}) => {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({
    data: contestData,
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
  it('keeps finalization recoverable while guest holds are active', async () => {
    mocks.clients.push(authClient(), adminClient({ rpcError: { message: 'guest_holds_active' } }));
    const response = await publishBoard({ request: request(), env, params: { id: 'board-1' } });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: 'ACTIVE_GUEST_HOLDS', error: 'Guests are choosing squares. Wait for their holds to finish, or cancel holds in Guest claim links before locking numbers.' });
  });

  it('retains exact fixed canonical columns when legacy JSON axes are absent or unusable', async () => {
    for (const axes of [{}, {leftAxis:[],topAxis:Array(10).fill(null)}]) {
      const admin=adminClient({contestData:{...contest,side_axis:contest.board_data.leftAxis,top_axis:contest.board_data.topAxis,board_data:{squares:contest.board_data.squares,...axes}}});
      mocks.clients.push(authClient(),admin);
      expect((await publishBoard({request:request(),env,params:{id:'board-1'}})).status).toBe(200);
      expect((admin.rpc.mock.calls as unknown as [string,any][])[0][1]).toMatchObject({p_side_axis:contest.board_data.leftAxis,p_top_axis:contest.board_data.topAxis});
    }
  });
  it('blocks unresolved photo orientation even with eight valid axes', async () => {
    const admin=adminClient({contestData:{...contest,board_data:{...contest.board_data,scanReview:{topTeamText:'CHI',leftTeamText:'GB',literalAxes:'literal'}}}});
    mocks.clients.push(authClient(),admin);
    const result=await publishBoard({request:request(),env,params:{id:'board-1'}});
    expect(result.status).toBe(409); expect(await result.json()).toEqual({error:expect.stringMatching(/photo team orientation/)});
    expect(admin.rpc).not.toHaveBeenCalled();
  });
  it('publishes all quarter sets and excludes literal scan evidence from the public payload', async () => {
    const digits = contest.board_data.leftAxis;
    const sets = {Q1:digits,Q2:[...digits.slice(1),0],Q3:[...digits.slice(2),0,1],Q4:[...digits].reverse()};
    const admin = adminClient({contestData:{...contest,board_data:{...contest.board_data,isDynamic:true,leftAxisByQuarter:sets,topAxisByQuarter:sets,scanReview:{literalAxes:'PRIVATE',orientation:{topAbbr:'GB',leftAbbr:'CHI',operation:'unchanged'}}}}});
    mocks.clients.push(authClient(),admin);
    const response = await publishBoard({request:request(),env,params:{id:'board-1'}});
    expect(response.status).toBe(200);
    const payload = (admin.rpc.mock.calls as unknown as [string,any][])[0][1];
    expect(payload.p_public_board.topAxisByQuarter).toEqual(sets);
    expect(payload.p_public_board.leftAxisByQuarter).toEqual(sets);
    expect(payload.p_public_board.isDynamic).toBe(true);
    expect(payload.p_public_board).not.toHaveProperty('scanReview');
    expect(payload.p_normalized_names).toEqual(contest.board_data.squares);
  });

  it('blocks duplicate or missing quarter axes even when fixed compatibility axes are valid', async () => {
    const digits = contest.board_data.leftAxis;
    for (const finalAxis of [undefined,[9,2,6,0,7,4,5,8,0,9]]) {
      const sets = {Q1:digits,Q2:digits,Q3:digits,...(finalAxis ? {Q4:finalAxis} : {})};
      const admin = adminClient({contestData:{...contest,board_data:{...contest.board_data,isDynamic:true,leftAxisByQuarter:sets,topAxisByQuarter:sets}}});
      mocks.clients.push(authClient(),admin);
      const response = await publishBoard({request:request(),env,params:{id:'board-1'}});
      expect(response.status).toBe(409);
      expect(admin.rpc).not.toHaveBeenCalled();
    }
  });

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
        p_allow_open_squares: false,
      }),
    );
  });

  it('keeps open-square publication behind explicit confirmation', async () => {
    const openContest = {
      ...contest,
      board_data: {
        ...contest.board_data,
        allowOpenSquares: true,
        squares: contest.board_data.squares.map((cell, index) => index < 6 ? [] : cell),
      },
    };
    const admin = adminClient({ contestData: openContest });
    mocks.clients.push(authClient(), admin);

    const rejected = await publishBoard({
      request: request(),
      env,
      params: { id: 'board-1' },
    });

    expect(rejected.status).toBe(409);
    await expect(rejected.json()).resolves.toEqual({
      error: '6 squares are still unassigned. Finish the board before publishing.',
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('publishes a partially assigned board only with allowOpenSquares true', async () => {
    const openContest = {
      ...contest,
      board_data: {
        ...contest.board_data,
        allowOpenSquares: true,
        squares: contest.board_data.squares.map((cell, index) => index < 6 ? [] : cell),
      },
    };
    const admin = adminClient({ contestData: openContest });
    mocks.clients.push(authClient(), admin);

    const response = await publishBoard({
      request: request({ allowOpenSquares: true }),
      env,
      params: { id: 'board-1' },
    });

    expect(response.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith('gridone_publish_board', expect.objectContaining({
      p_allow_open_squares: true,
      p_normalized_names: expect.arrayContaining([[]]),
      p_public_board: expect.objectContaining({ allowOpenSquares: true }),
    }));
  });

  it('rejects request-only confirmation that was not persisted with the draw', async () => {
    const openContest = {
      ...contest,
      board_data: {
        ...contest.board_data,
        squares: contest.board_data.squares.map((cell, index) => index < 6 ? [] : cell),
      },
    };
    const admin = adminClient({ contestData: openContest });
    mocks.clients.push(authClient(), admin);

    const response = await publishBoard({
      request: request({ allowOpenSquares: true }),
      env,
      params: { id: 'board-1' },
    });

    expect(response.status).toBe(409);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it.each([
    [
      'free',
      1,
      1,
      'gameday',
      'Your free plan includes 1 board per season. Choose the Game Day plan to publish another.',
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
