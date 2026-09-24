import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ pool: {} as any, scoring: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() }));
vi.mock('../hooks/usePoolData', () => ({ usePoolData: () => m.pool, INITIAL_GAME: {} }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('../hooks/useContestEntries', () => ({ useContestEntries: () => ({ entryMetaByIndex: {}, hasLoadedEntries: true, setEntryMetaByIndex: vi.fn() }) }));
vi.mock('../hooks/useBoardActions', () => ({ useBoardActions: () => ({ handlePublish: vi.fn() }) }));
vi.mock('../hooks/useLiveScoring', () => ({ useLiveScoring: (...args: any[]) => { m.scoring(...args); return { liveData: { leftScore: 0, topScore: 0, quarterScores: {}, state: 'pre', period: 0 }, winnerHistory: [], pendingMilestones: [], liveStatus: 'idle' }; } }));
vi.mock('../services/supabase', () => ({ supabase: { channel: m.channel, removeChannel: m.removeChannel } }));
vi.mock('../src/features/viewer/shell/ViewerShell', () => ({ default: () => <main>Finalized game viewer</main> }));
import BoardView from '../components/BoardView';
beforeEach(() => {
  m.scoring.mockClear();
  m.channel.mockReset();
  m.channel.mockImplementation(() => {
    const realtime: any = { on: vi.fn(() => realtime), subscribe: vi.fn((callback: (status: string) => void) => { callback('SUBSCRIBED'); return realtime; }) };
    return realtime;
  });
  m.pool = { game: { title: 'Team board', leftName: 'Dallas', topName: 'Washington' }, board: { squares: Array.from({ length: 100 }, () => []), allocationLabels: Array(100).fill('Mora family') }, activePoolId: 'ABCDEFGH', shareCode: 'ABCDEFGH', ownerId: null, loadingPool: false, dataReady: true, isShared: true, isPublished: false, isActivated: true, winnerHistory: [], pendingMilestones: [], loadPoolData: vi.fn(), setBoard: vi.fn(), setGame: vi.fn(), updatedAt: '2026-09-04T12:00:00Z' };
});
afterEach(() => vi.restoreAllMocks());
const show = () => render(<MemoryRouter initialEntries={['/b/ABCDEFGH']}><Routes><Route path="/b/:shareCode" element={<BoardView />} /></Routes></MemoryRouter>);
it('routes a shared unfinalized board to selling view without score services', async () => {
  show();
  // The selling view is its own code chunk, so it appears once that loads.
  expect(await screen.findByRole('main', { name: 'Team board selling board' })).toBeInTheDocument();
  expect(screen.queryByText('Finalized game viewer')).not.toBeInTheDocument();
  expect(m.scoring.mock.lastCall?.[5]).toBe(false);
});
it('uses game viewer once the same shared board is finalized', () => {
  m.pool.isPublished = true;
  show();
  expect(screen.getByText('Finalized game viewer')).toBeInTheDocument();
  expect(m.scoring.mock.lastCall?.[5]).toBe(true);
});

it('offers a retry when reloading the board fails', () => {
  m.pool.error = 'Connection unavailable';
  show();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

it('loads guest occupancy by canonical board UUID and overlays holds on the public sales board', async () => {
  m.pool.activePoolId = '11111111-1111-4111-8111-111111111111';
  const guestSquares = Array.from({ length: 100 }, () => [] as string[]);
  guestSquares[1] = ['Jamie Guest'];
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    boardId: m.pool.activePoolId, title: 'Team board', shareCode: 'ABCDEFGH', revision: 9,
    serverTime: '2026-09-20T12:00:00Z', stage: 'selling', squares: guestSquares,
    allocationLabels: m.pool.board.allocationLabels, availability: Array.from({ length: 100 }, (_, index) => index === 1 ? 'unavailable' : 'available'),
    holds: [{ index: 0, expiresAt: '2026-09-20T12:01:30Z' }], claimedCells: [1],
  })));
  show();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/pools/11111111-1111-4111-8111-111111111111/guest-state', expect.objectContaining({ cache: 'no-store' })));
  await waitFor(() => expect(m.channel).toHaveBeenCalledWith('pool:11111111-1111-4111-8111-111111111111'));
  expect(await screen.findByRole('gridcell', { name: /Square 1.*temporarily held/i })).toBeInTheDocument();
  expect(screen.getByRole('gridcell', { name: /Square 2, Jamie Guest.*claimed through a guest link/i })).toBeInTheDocument();
  expect(screen.getByText('Squares with names').previousElementSibling).toHaveTextContent('1 / 100');
});

it('keeps the normal sales view when guest occupancy is gated off', async () => {
  m.pool.activePoolId = '11111111-1111-4111-8111-111111111111';
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
  show();
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  expect(screen.queryByText(/Guest availability/)).not.toBeInTheDocument();
  expect(screen.getByRole('main', { name: 'Team board selling board' })).toBeInTheDocument();
});

it('reloads the canonical route when guest state reports final publication', async () => {
  m.pool.activePoolId = '11111111-1111-4111-8111-111111111111';
  m.pool.loadPoolData = vi.fn(async () => { m.pool.isPublished = true; });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
    boardId: m.pool.activePoolId, title: 'Team board', shareCode: 'ABCDEFGH', revision: 10,
    serverTime: '2026-09-20T12:00:00Z', stage: 'finalized', squares: m.pool.board.squares,
    allocationLabels: m.pool.board.allocationLabels, availability: Array(100).fill('unavailable'),
    holds: [], claimedCells: [],
  })));
  const view = show();
  await waitFor(() => expect(m.pool.loadPoolData).toHaveBeenCalledWith('ABCDEFGH', { background: true }));
  view.rerender(<MemoryRouter initialEntries={['/b/ABCDEFGH']}><Routes><Route path="/b/:shareCode" element={<BoardView />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Finalized game viewer')).toBeInTheDocument();
});
