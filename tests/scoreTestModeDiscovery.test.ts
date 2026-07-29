import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetchScheduledGames: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../functions/_lib/espnNfl', () => ({
  fetchScheduledGames: mocks.fetchScheduledGames,
}));

import { onRequestGet } from '../functions/api/nfl/games';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_OWNER_ID = '33333333-3333-4333-8333-333333333333';
const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SCORE_TEST_MODE_ENABLED: 'true',
  SCORE_TEST_MODE_OWNER_IDS: OWNER_ID,
};

const request = (scope: 'upcoming' | 'completed', authorization?: string) =>
  new Request(`https://www.getgridone.com/api/nfl/games?scope=${scope}&limit=5`, {
    headers: authorization ? { Authorization: authorization } : undefined,
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchScheduledGames.mockResolvedValue([]);
});

describe('score-test completed-game discovery gate', () => {
  it('silently serves the ordinary upcoming list when the server flag is off', async () => {
    const response = await onRequestGet({
      request: request('completed', 'Bearer token'),
      env: { ...env, SCORE_TEST_MODE_ENABLED: 'false' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ games: [] });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetchScheduledGames).toHaveBeenCalledWith({
      scope: 'upcoming',
      limit: 5,
    });
  });

  it('silently serves upcoming games to an authenticated non-allowlisted owner', async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: OTHER_OWNER_ID } },
        }),
      },
    });

    const response = await onRequestGet({
      request: request('completed', 'Bearer token'),
      env,
    });

    expect(await response.json()).toEqual({ games: [] });
    expect(mocks.fetchScheduledGames).toHaveBeenCalledWith({
      scope: 'upcoming',
      limit: 5,
    });
  });

  it('returns completed games and capability only when both gates pass', async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: OWNER_ID } },
        }),
      },
    });

    const response = await onRequestGet({
      request: request('completed', 'Bearer token'),
      env,
    });

    expect(await response.json()).toEqual({ games: [], scoreTestMode: true });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.fetchScheduledGames).toHaveBeenCalledWith({
      scope: 'completed',
      limit: 5,
    });
  });

  it('preserves the standard public upcoming-games behavior', async () => {
    const response = await onRequestGet({
      request: request('upcoming'),
      env,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ games: [] });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetchScheduledGames).toHaveBeenCalledWith({
      scope: 'upcoming',
      limit: 5,
    });
    expect(response.headers.get('Cache-Control')).toContain('public');
  });
});
