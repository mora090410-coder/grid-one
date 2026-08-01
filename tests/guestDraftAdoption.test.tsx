import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../pages/Dashboard';
import Login from '../pages/Login';

const mocks = vi.hoisted(() => {
  const auth = {
    session: null as Record<string, unknown> | null,
    user: null as { id: string } | null,
    loading: false,
    signOut: vi.fn(),
  };
  return {
    auth,
    migrateGuestBoard: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    getSession: vi.fn(async () => ({ data: { session: null } })),
    from: vi.fn(),
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../hooks/usePoolData', () => ({
  default: () => ({ migrateGuestBoard: mocks.migrateGuestBoard }),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      getSession: mocks.getSession,
    },
    from: mocks.from,
  },
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const contestQuery = () => {
  const query: Record<string, any> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(async () => ({ data: [], error: null }));
  return query;
};

beforeEach(() => {
  localStorage.clear();
  mocks.auth.session = null;
  mocks.auth.user = null;
  mocks.auth.loading = false;
  mocks.auth.signOut.mockReset();
  mocks.migrateGuestBoard.mockReset();
  mocks.signUp.mockReset();
  mocks.signInWithPassword.mockReset();
  mocks.getSession.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.from.mockReset();
  mocks.from.mockImplementation(() => contestQuery());
});

describe('guest draft adoption naming and routing', () => {
  it('carries adopt-draft mode from login to the dashboard for an existing session', async () => {
    mocks.auth.session = { access_token: 'session-token' };

    render(
      <MemoryRouter initialEntries={['/login?mode=adopt-draft']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard?mode=adopt-draft');
  });

  it('uses save-draft language instead of participant claiming language', () => {
    render(
      <MemoryRouter initialEntries={['/login?mode=adopt-draft']}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Sign in to save your draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In & Save Draft' })).toBeInTheDocument();
    expect(screen.queryByText(/claim board/i)).not.toBeInTheDocument();
  });

  it('automatically saves a local guest draft only in adopt-draft mode', async () => {
    mocks.auth.user = { id: 'owner-1' };
    mocks.migrateGuestBoard.mockImplementation(() => new Promise<string>(() => {}));
    localStorage.setItem('squares_game', JSON.stringify({ title: 'Week One', gameExternalId: 'game-1' }));
    localStorage.setItem('squares_board', JSON.stringify({ squares: [] }));

    render(
      <MemoryRouter initialEntries={['/dashboard?mode=adopt-draft']}>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.migrateGuestBoard).toHaveBeenCalledTimes(1));
    expect(mocks.migrateGuestBoard).toHaveBeenCalledWith(
      { id: 'owner-1' },
      {
        game: { title: 'Week One', gameExternalId: 'game-1' },
        board: { squares: [] },
      },
    );
  });

  it('does not treat the legacy claim query as guest-draft adoption', async () => {
    mocks.auth.user = { id: 'owner-1' };
    localStorage.setItem('squares_game', JSON.stringify({ title: 'Week One', gameExternalId: 'game-1' }));
    localStorage.setItem('squares_board', JSON.stringify({ squares: [] }));

    render(
      <MemoryRouter initialEntries={['/dashboard?mode=claim']}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Unsaved Board Found')).toBeInTheDocument();
    await act(async () => Promise.resolve());
    expect(mocks.migrateGuestBoard).not.toHaveBeenCalled();
  });
});
