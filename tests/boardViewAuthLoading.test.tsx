import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ pool: {} as any, auth: { user: null as null | { id: string }, loading: true } }));
vi.mock('../hooks/usePoolData', () => ({ usePoolData: () => m.pool, INITIAL_GAME: {} }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => m.auth }));
vi.mock('../hooks/useContestEntries', () => ({ useContestEntries: () => ({ entryMetaByIndex: {}, hasLoadedEntries: true, setEntryMetaByIndex: vi.fn() }) }));
vi.mock('../hooks/useBoardActions', () => ({ useBoardActions: () => ({ handlePublish: vi.fn() }) }));
vi.mock('../hooks/useLiveScoring', () => ({ useLiveScoring: () => ({ liveData: null, winnerHistory: [], pendingMilestones: [], liveStatus: 'idle' }) }));
vi.mock('../services/supabase', () => ({ supabase: { channel: vi.fn(), removeChannel: vi.fn() } }));
vi.mock('../src/features/viewer/shell/ViewerShell', () => ({ default: () => <main>Public viewer</main> }));
import BoardView from '../components/BoardView';

const BOARD_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  m.auth = { user: null, loading: true };
  m.pool = {
    game: { title: 'Board' }, board: { leftAxis: [], topAxis: [], squares: Array.from({ length: 100 }, () => []) },
    activePoolId: BOARD_ID, shareCode: 'ABCDEFGH', ownerId: 'organizer-1',
    loadingPool: false, dataReady: true, isShared: false, isPublished: true, isActivated: true, isLocked: false,
    winnerHistory: [], pendingMilestones: [], loadPoolData: vi.fn(), setBoard: vi.fn(), setGame: vi.fn(),
  };
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
});

const LoginProbe = () => <h1>Login page</h1>;

describe('BoardView while the sign-in check runs', () => {
  it('holds an organizer route instead of rendering the public viewer or redirecting', () => {
    window.history.replaceState(null, '', `/?poolId=${BOARD_ID}`);
    render(
      <MemoryRouter initialEntries={[`/?poolId=${BOARD_ID}`]}>
        <Routes>
          <Route path="/" element={<BoardView />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Public viewer')).toBeNull();
    expect(screen.queryByText('Login page')).toBeNull();
  });

  it('renders a public viewer link without waiting', () => {
    m.pool.ownerId = null;
    render(
      <MemoryRouter initialEntries={['/b/ABCDEFGH']}>
        <Routes><Route path="/b/:shareCode" element={<BoardView />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Public viewer')).toBeInTheDocument();
  });
});
