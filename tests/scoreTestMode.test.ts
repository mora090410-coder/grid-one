import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetchScheduledGameById: vi.fn(),
  fetchScheduledGames: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../functions/_lib/espnNfl', () => ({
  fetchScheduledGameById: mocks.fetchScheduledGameById,
  fetchScheduledGames: mocks.fetchScheduledGames,
}));

import {
  onRequestPost,
  scoreTestModeAllowed,
} from '../functions/api/pools';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_OWNER_ID = '33333333-3333-4333-8333-333333333333';

const completedGame = {
  id: '401772510',
  kickoffAt: '2026-01-11T18:00:00.000Z',
  state: 'post' as const,
  season: 2025,
  week: 'Wild Card',
  awayTeam: { abbr: 'CHI', name: 'Chicago Bears' },
  homeTeam: { abbr: 'GB', name: 'Green Bay Packers' },
};

const upcomingGame = {
  ...completedGame,
  id: '401772511',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  state: 'pre' as const,
  season: 2026,
  week: 1,
};

const baseEnv = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  PUBLIC_SITE_URL: 'https://www.getgridone.com',
};

const request = (gameExternalId: string, scoreTestMode: boolean) => new Request(
  'https://www.getgridone.com/api/pools',
  {
    method: 'POST',
    headers: {
      Authorization: 'Bearer user-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scoreTestMode,
      game: { title: 'Test board', gameExternalId },
      board: { squares: Array.from({ length: 100 }, () => []) },
    }),
  },
);

const insertClient = () => {
  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          share_code: 'ABCDEFGH',
          revision: 1,
        },
        error: null,
      }),
    }),
  });
  return {
    insert,
    client: { from: vi.fn().mockReturnValue({ insert }) },
  };
};

const authClient = (writeClient?: ReturnType<typeof insertClient>['client']) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: OWNER_ID } },
      error: null,
    }),
  },
  ...(writeClient || {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchScheduledGameById.mockResolvedValue(completedGame);
  mocks.fetchScheduledGames.mockResolvedValue([completedGame]);
});

describe('score-test mode gate', () => {
  it('requires an exact server flag and an independently allowlisted owner', () => {
    expect(scoreTestModeAllowed({}, OWNER_ID)).toBe(false);
    expect(scoreTestModeAllowed({
      SCORE_TEST_MODE_ENABLED: 'false',
      SCORE_TEST_MODE_OWNER_IDS: OWNER_ID,
    }, OWNER_ID)).toBe(false);
    expect(scoreTestModeAllowed({
      SCORE_TEST_MODE_ENABLED: 'true',
      SCORE_TEST_MODE_OWNER_IDS: OTHER_OWNER_ID,
    }, OWNER_ID)).toBe(false);
    expect(scoreTestModeAllowed({
      SCORE_TEST_MODE_ENABLED: 'true',
      SCORE_TEST_MODE_OWNER_IDS: `${OTHER_OWNER_ID}, ${OWNER_ID}`,
    }, OWNER_ID)).toBe(true);
  });

  it('silently treats a requested test board as ordinary when the flag is off', async () => {
    mocks.createClient.mockReturnValue(authClient());

    const response = await onRequestPost({
      request: request(completedGame.id, true),
      env: baseEnv,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Choose an upcoming NFL game.',
    });
    expect(mocks.fetchScheduledGames).not.toHaveBeenCalled();
  });

  it('silently treats a requested test board as ordinary for a non-allowlisted owner', async () => {
    mocks.createClient.mockReturnValue(authClient());

    const response = await onRequestPost({
      request: request(completedGame.id, true),
      env: {
        ...baseEnv,
        SCORE_TEST_MODE_ENABLED: 'true',
        SCORE_TEST_MODE_OWNER_IDS: OTHER_OWNER_ID,
      },
    });

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.not.toMatch(/test mode|score-test/i);
    expect(mocks.fetchScheduledGames).not.toHaveBeenCalled();
  });

  it('persists the permanent flag through a service write only when both gates pass', async () => {
    const userWrite = insertClient();
    const serviceWrite = insertClient();
    mocks.createClient.mockImplementation((_url: string, key: string) =>
      key === baseEnv.SUPABASE_SERVICE_ROLE_KEY
        ? serviceWrite.client
        : authClient(userWrite.client)
    );

    const response = await onRequestPost({
      request: request(completedGame.id, true),
      env: {
        ...baseEnv,
        SCORE_TEST_MODE_ENABLED: 'true',
        SCORE_TEST_MODE_OWNER_IDS: OWNER_ID,
      },
    });

    expect(response.status).toBe(201);
    expect(userWrite.insert).not.toHaveBeenCalled();
    expect(serviceWrite.insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: OWNER_ID,
      score_test_mode: true,
      game_external_id: completedGame.id,
    }));
  });

  it('persists false through the owner-scoped client for an ordinary upcoming board', async () => {
    const userWrite = insertClient();
    mocks.createClient.mockReturnValue(authClient(userWrite.client));
    mocks.fetchScheduledGameById.mockResolvedValue(upcomingGame);

    const response = await onRequestPost({
      request: request(upcomingGame.id, true),
      env: baseEnv,
    });

    expect(response.status).toBe(201);
    expect(userWrite.insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: OWNER_ID,
      score_test_mode: false,
    }));
  });
});
