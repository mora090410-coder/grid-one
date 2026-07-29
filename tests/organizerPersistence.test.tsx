import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: { getSession: getSessionMock },
  },
}));

import { usePoolData } from '../hooks/usePoolData';

const game = {
  title: 'Organizer board',
  meta: 'Fundraiser',
  gameExternalId: '401772510',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  dates: '2026-09-13',
  leftAbbr: 'DAL',
  leftName: 'Dallas Cowboys',
  topAbbr: 'WAS',
  topName: 'Washington Commanders',
  lockTitle: false,
  lockMeta: false,
};

const board = {
  bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  oppAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: Array.from({ length: 100 }, () => ['Mora']),
  isDynamic: false,
};

describe('organizer save ordering', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    vi.restoreAllMocks();
  });

  it('serializes draft saves and advances the revision before sending the next edit', async () => {
    let releaseFirstSave!: () => void;
    const firstSaveGate = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    const revisions: number[] = [];
    let putCount = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method) {
        return new Response(JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          share_code: 'ABCDEFGH',
          owner_id: '22222222-2222-4222-8222-222222222222',
          revision: 1,
          ...game,
          board,
          payouts: { Q1: 25, Q2: 50, Q3: 25, Final: 100 },
          is_activated: true,
          locked: false,
          published_at: null,
        }), { status: 200 });
      }

      const payload = JSON.parse(String(init.body));
      revisions.push(payload.revision);
      putCount += 1;
      if (putCount === 1) await firstSaveGate;
      return new Response(JSON.stringify({
        ok: true,
        revision: putCount + 1,
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePoolData());
    await act(async () => {
      await result.current.loadPoolData('11111111-1111-4111-8111-111111111111');
    });

    let firstSave!: Promise<boolean>;
    let secondSave!: Promise<boolean>;
    act(() => {
      firstSave = result.current.updatePool(
        '11111111-1111-4111-8111-111111111111',
        { game: { ...game, title: 'First edit' }, board },
      );
      secondSave = result.current.updatePool(
        '11111111-1111-4111-8111-111111111111',
        { game: { ...game, title: 'Latest edit' }, board },
      );
    });

    await waitFor(() => expect(revisions).toEqual([1]));

    releaseFirstSave();
    await act(async () => {
      await expect(firstSave).resolves.toBe(true);
      await expect(secondSave).resolves.toBe(true);
    });

    expect(revisions).toEqual([1, 2]);
  });
});
