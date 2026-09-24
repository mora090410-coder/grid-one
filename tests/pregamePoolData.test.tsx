import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../services/supabase', () => ({ supabase: { auth: { getSession } } }));
import { usePoolData } from '../hooks/usePoolData';

const id = '11111111-1111-4111-8111-111111111111';
const board = { squares: Array.from({ length: 100 }, () => []), leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), allocationLabels: Array.from({ length: 100 }, (_, i) => i % 11 === 0 ? 'Mora family' : null) };
const stored = { id, title: 'Team board', revision: 3, board, published_at: null, shared_at: '2026-09-04T12:00:00Z', updated_at: '2026-09-04T12:01:00Z', share_code: 'ABCDEFGH', is_activated: true };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe('pregame board persistence', () => {
  beforeEach(() => { vi.restoreAllMocks(); getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } }); });
  it('loads sharing separately from number locking and preserves public allocations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(stored)));
    const { result } = renderHook(() => usePoolData());
    await act(async () => { await result.current.loadPoolData(id); });
    expect(result.current.isShared).toBe(true);
    expect(result.current.isPublished).toBe(false);
    expect(result.current.updatedAt).toBe(stored.updated_at);
    expect(result.current.board.allocationLabels?.[11]).toBe('Mora family');
  });
  it('shares the current revision and retains editable local board state', async () => {
    const requests: {url: string; body: any}[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (!init?.method) return response({ ...stored, shared_at: null });
      requests.push({ url: String(url), body: JSON.parse(String(init.body)) });
      return response({ shared: true, sharedAt: stored.shared_at, shareCode: 'ABCDEFGH', revision: 4, tier: 'free', used: 1, allowance: 1 });
    }));
    const { result } = renderHook(() => usePoolData());
    await act(async () => { await result.current.loadPoolData(id); });
    await act(async () => { await result.current.shareBoard(id); });
    expect(requests).toEqual([{ url: `/api/pools/${id}/share`, body: { revision: 3 } }]);
    expect(result.current.isShared).toBe(true);
    expect(result.current.isPublished).toBe(false);
    expect(result.current.revision).toBe(4);
    expect(result.current.board).toMatchObject(board);
  });
  it('keeps an unshared board private after a failed share and returns upgrade context', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => init?.method
      ? response({ error: 'Choose a plan', code: 'PUBLISH_ALLOWANCE_EXHAUSTED', upgradeTo: 'gameday' }, 402)
      : response({ ...stored, shared_at: null })));
    const { result } = renderHook(() => usePoolData());
    await act(async () => { await result.current.loadPoolData(id); });
    await act(async () => { await expect(result.current.shareBoard(id)).rejects.toMatchObject({ upgradeTo: 'gameday' }); });
    expect(result.current.isShared).toBe(false);
    expect(result.current.revision).toBe(3);
  });
  it('retains the last saved board during failed background refresh and reports freshness failure', async () => {
    let fail = false;
    vi.stubGlobal('fetch', vi.fn(async () => fail ? response({ error: 'Temporarily unavailable' }, 503) : response(stored)));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => usePoolData());
    await act(async () => { await result.current.loadPoolData('ABCDEFGH'); });
    fail = true;
    await act(async () => { await result.current.loadPoolData('ABCDEFGH', { background: true }); });
    expect(result.current.board).toMatchObject(board);
    expect(result.current.refreshError).toBe('Temporarily unavailable');
    expect(result.current.error).toBe(null);
    expect(result.current.refreshing).toBe(false);
  });
});


it('retains the dynamic marker so legacy boards cannot enter fixed-axis sharing', async () => {
  getSession.mockResolvedValue({ data: { session: null } });
  vi.stubGlobal('fetch', vi.fn(async () => response({ ...stored, board: { ...board, isDynamic: true } })));
  const { result } = renderHook(() => usePoolData());
  await act(async () => { await result.current.loadPoolData(id); });
  expect(result.current.board.isDynamic).toBe(true);
});


it('recovers from an unavailable response when the same link becomes available again', async () => {
  getSession.mockResolvedValue({ data: { session: null } });
  let unavailable = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => unavailable ? response({ error: 'Board not found' }, 404) : response(stored)));
  const { result } = renderHook(() => usePoolData());
  await act(async () => { await result.current.loadPoolData('ABCDEFGH'); });
  expect(result.current.error).toBe('Board not found');
  unavailable = false;
  await act(async () => { await result.current.loadPoolData('ABCDEFGH', { background: true }); });
  expect(result.current.error).toBe(null);
});
it('ignores a background load that answers with an older revision than a save already acknowledged', async () => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  let releaseLoad!: (value: Response) => void;
  let loads = 0;
  vi.stubGlobal('fetch', vi.fn((_url, init) => {
    if (init?.method === 'PUT') return Promise.resolve(response({ revision: 4 }));
    loads += 1;
    if (loads === 1) return Promise.resolve(response(stored));
    return new Promise<Response>((resolve) => { releaseLoad = resolve; });
  }));
  const { result } = renderHook(() => usePoolData());
  await act(async () => { await result.current.loadPoolData(id); });
  let late!: Promise<void>;
  act(() => { late = result.current.loadPoolData(id, { background: true }); });
  await act(async () => { await result.current.updatePool(id, { game: result.current.game, board }); });
  expect(result.current.revision).toBe(4);
  await act(async () => { releaseLoad(response({ ...stored, title: 'Older copy', revision: 3 })); await late; });
  expect(result.current.revision).toBe(4);
  expect(result.current.game.title).toBe('Team board');
  expect(result.current.refreshing).toBe(false);
});
