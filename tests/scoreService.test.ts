import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLiveScore } from '../services/scoreService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('score service authorization', () => {
  it('sends an organizer bearer token for UUID score refreshes', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      score: {
        leftScore: 0,
        topScore: 0,
        quarterScores: {
          Q1: { left: 0, top: 0 },
          Q2: { left: 0, top: 0 },
          Q3: { left: 0, top: 0 },
          Q4: { left: 0, top: 0 },
          OT: { left: 0, top: 0 },
        },
        clock: '',
        period: 0,
        state: 'pre',
        detail: 'Scheduled',
        isOvertime: false,
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchLiveScore('11111111-1111-4111-8111-111111111111', 'owner-token');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pools/11111111-1111-4111-8111-111111111111/score',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer owner-token',
        },
      }),
    );
  });

  it('keeps public share-code refreshes unauthenticated when no token exists', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      score: {
        leftScore: 0,
        topScore: 0,
        quarterScores: {},
        state: 'pre',
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchLiveScore('ABCDEFGH', null);

    expect(fetchMock).toHaveBeenCalledWith('/api/pools/ABCDEFGH/score', expect.objectContaining({
      headers: { Accept: 'application/json' },
    }));
  });
});
