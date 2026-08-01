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
          payoutDescriptions: { Q1: 'Winner gets bragging rights' },
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

  it('keeps the organizer open and refreshes the retry revision after a conflict', async () => {
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
          payoutDescriptions: { Q1: 'Winner gets bragging rights' },
          is_activated: true,
          locked: false,
          published_at: null,
        }), { status: 200 });
      }

      const payload = JSON.parse(String(init.body));
      revisions.push(payload.revision);
      putCount += 1;
      if (putCount === 1) {
        return new Response(JSON.stringify({
          error: 'This board changed in another session. Reload before saving again.',
          code: 'REVISION_CONFLICT',
          currentRevision: 2,
        }), { status: 409 });
      }
      return new Response(JSON.stringify({ ok: true, revision: 3 }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePoolData());
    await act(async () => {
      await result.current.loadPoolData('11111111-1111-4111-8111-111111111111');
    });

    await act(async () => {
      await expect(result.current.updatePool(
        '11111111-1111-4111-8111-111111111111',
        { game: { ...game, title: 'Keep this local draft' }, board },
      )).resolves.toBe(false);
    });

    expect(result.current.error).toBeNull();

    await act(async () => {
      await expect(result.current.updatePool(
        '11111111-1111-4111-8111-111111111111',
        { game: { ...game, title: 'Keep this local draft' }, board },
      )).resolves.toBe(true);
    });

    expect(revisions).toEqual([1, 2]);
  });

  it('serializes payout description edits with draft saves and advances the shared revision', async () => {
    const requests: Array<{ method: string; revision: number }> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method) {
        return new Response(JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          share_code: 'ABCDEFGH',
          owner_id: '22222222-2222-4222-8222-222222222222',
          revision: 1,
          ...game,
          board,
          payoutDescriptions: {},
          is_activated: true,
          locked: false,
          published_at: '2026-08-01T18:00:00.000Z',
        }), { status: 200 });
      }

      const payload = JSON.parse(String(init.body));
      requests.push({ method: String(init.method), revision: payload.revision });
      if (init.method === 'PATCH') {
        return new Response(JSON.stringify({
          ok: true,
          revision: 2,
          payoutDescriptions: { Q1: 'A pie' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, revision: 3 }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePoolData());
    await act(async () => {
      await result.current.loadPoolData('11111111-1111-4111-8111-111111111111');
    });

    await act(async () => {
      await expect(result.current.updatePayoutDescriptions(
        '11111111-1111-4111-8111-111111111111',
        { Q1: 'A pie' },
      )).resolves.toEqual({ Q1: 'A pie' });
      await expect(result.current.updatePool(
        '11111111-1111-4111-8111-111111111111',
        { game: { ...game, title: 'Next edit' }, board },
      )).resolves.toBe(true);
    });

    expect(requests).toEqual([
      { method: 'PATCH', revision: 1 },
      { method: 'PUT', revision: 2 },
    ]);
    expect(result.current.game.payoutDescriptions).toEqual({ Q1: 'A pie' });
  });

  it('submits the complete late-fill board through the dedicated revisioned endpoint', async () => {
    const openBoard = { ...board, squares: board.squares.map((names, index) => index === 99 ? [] : names) };
    const filledSquares = openBoard.squares.map((names, index) => index === 99 ? ['Late buyer'] : names);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method) {
        return new Response(JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          share_code: 'ABCDEFGH',
          owner_id: '22222222-2222-4222-8222-222222222222',
          revision: 4,
          ...game,
          board: openBoard,
          payoutDescriptions: {},
          is_activated: true,
          locked: true,
          published_at: '2026-08-01T18:00:00.000Z',
        }), { status: 200 });
      }
      expect(String(input)).toBe('/api/pools/11111111-1111-4111-8111-111111111111/open-squares');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ revision: 4, squares: filledSquares });
      return new Response(JSON.stringify({ success: true, revision: 5 }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePoolData());
    await act(async () => {
      await result.current.loadPoolData('11111111-1111-4111-8111-111111111111');
      await result.current.updatePublishedOpenSquares(
        '11111111-1111-4111-8111-111111111111',
        filledSquares,
      );
    });

    expect(result.current.revision).toBe(5);
  });
});
