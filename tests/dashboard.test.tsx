import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../pages/Dashboard';

const mocks = vi.hoisted(() => {
  const auth = {
    user: { id: 'owner-1' } as { id: string } | null,
    loading: false,
    signOut: vi.fn(),
  };
  return {
    auth,
    migrateGuestBoard: vi.fn(),
    getSession: vi.fn(async () => ({ data: { session: null as { access_token: string } | null } })),
    from: vi.fn(),
    deleteEq: vi.fn(),
    deleteResult: vi.fn(async () => ({ data: [{ id: 'board-1' }], error: null })),
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
    auth: { getSession: mocks.getSession },
    from: mocks.from,
  },
}));

const drawnAxis = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const boardWithSquares = (names: string[]) => {
  const squares = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => ''));
  names.forEach((name, index) => {
    squares[Math.floor(index / 10)][index % 10] = name;
  });
  return { leftAxis: drawnAxis, topAxis: drawnAxis, squares };
};

const rows = [
  {
    id: 'board-1',
    title: 'Chiefs Fundraiser',
    created_at: '2026-01-02T00:00:00.000Z',
    settings: { leftAbbr: 'KC', topAbbr: 'BUF' },
    board_data: boardWithSquares(['Ann', 'Ben', 'Cara']),
    status: 'draft',
    published_at: null,
    board_activations: [{ id: 'activation-1' }],
  },
  {
    id: 'board-2',
    title: 'Booster Draft',
    created_at: '2026-01-01T00:00:00.000Z',
    settings: { leftAbbr: 'SF', topAbbr: 'PHI' },
    board_data: null,
    status: 'draft',
    published_at: null,
    board_activations: [],
  },
];

const contestQuery = (data: unknown[]) => {
  const query: Record<string, any> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(async () => ({ data, error: null }));
  query.delete = vi.fn(() => ({ eq: mocks.deleteEq }));
  return query;
};

const useContests = (data: unknown[]) => {
  mocks.from.mockImplementation(() => contestQuery(data));
};

const renderDashboard = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <Dashboard />
  </MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear();
  mocks.auth.user = { id: 'owner-1' };
  mocks.auth.loading = false;
  mocks.auth.signOut.mockReset();
  mocks.migrateGuestBoard.mockReset();
  mocks.getSession.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.from.mockReset();
  mocks.deleteEq.mockReset();
  mocks.deleteEq.mockReturnValue({ select: mocks.deleteResult });
  mocks.deleteResult.mockReset();
  mocks.deleteResult.mockResolvedValue({ data: [{ id: 'board-1' }], error: null });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  useContests([]);
});

describe('organizer dashboard', () => {
  it('uses the light wordmark on the dark organizer background', async () => {
    renderDashboard();
    await screen.findByRole('heading', { name: 'Your boards' });
    expect(screen.getByRole('img', { name: 'GridOne' })).toHaveAttribute('src', expect.stringContaining('gridone-lockup-horizontal-white.svg'));
  });

  it('starts another board with only reusable setup and no immediate server mutation', async () => {
    const source = { ...rows[0], settings: { title: 'Old title', gameExternalId: 'old-game', payoutDescriptions: { Q1: '$25 stale' } }, payout_descriptions: { Q1: '$100' } };
    useContests([source]);
    const Destination = () => <output aria-label="Create navigation">{JSON.stringify(useLocation().state)}</output>;
    render(<MemoryRouter initialEntries={['/dashboard']}><Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/create" element={<Destination />} />
    </Routes></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Run another board using Chiefs Fundraiser' }));

    expect(screen.getByLabelText('Create navigation')).toHaveTextContent(JSON.stringify({ boardTemplate: { title: 'Chiefs Fundraiser', payoutDescriptions: { Q1: '$100' } } }));
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.deleteEq).not.toHaveBeenCalled();
    expect(source.board_data).toEqual(rows[0].board_data);
  });
  it('renders a row per board with its matchup and a link to the board', async () => {
    useContests(rows);
    renderDashboard();

    expect(await screen.findByRole('link', { name: 'Chiefs Fundraiser' }))
      .toHaveAttribute('href', '/boards/board-1');
    expect(screen.getByRole('link', { name: 'Booster Draft' }))
      .toHaveAttribute('href', '/boards/board-2');
    expect(screen.getByText('KC at BUF')).toBeInTheDocument();
    expect(screen.getByText('SF at PHI')).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Your boards' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('selects the board fields the rings and status need', async () => {
    useContests(rows);
    renderDashboard();

    await screen.findByRole('link', { name: 'Chiefs Fundraiser' });
    const query = mocks.from.mock.results[0].value;
    expect(query.select).toHaveBeenCalledWith(
      'id, title, created_at, settings, payout_descriptions, board_data, status, published_at, shared_at, board_activations(id)',
    );
  });

  it('tags an activated board Published and an untouched board Draft', async () => {
    useContests(rows);
    renderDashboard();

    expect(await screen.findByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows fill and draw rings, treating a missing board_data as empty', async () => {
    useContests(rows);
    renderDashboard();

    expect(await screen.findByLabelText('3 of 100 squares filled on Chiefs Fundraiser')).toBeInTheDocument();
    expect(screen.getByLabelText('Numbers drawn on Chiefs Fundraiser')).toBeInTheDocument();
    expect(screen.getByLabelText('0 of 100 squares filled on Booster Draft')).toBeInTheDocument();
    expect(screen.getByLabelText('Numbers not drawn on Booster Draft')).toBeInTheDocument();
  });

  it('deletes a board only after a second confirming press', async () => {
    useContests(rows);
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Chiefs Fundraiser' }));
    expect(mocks.deleteEq).not.toHaveBeenCalled();

    const confirm = await screen.findByRole('button', { name: 'Confirm deletion of Chiefs Fundraiser' });
    expect(confirm).toHaveTextContent('Confirm?');

    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.deleteEq).toHaveBeenCalledWith('id', 'board-1'));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Chiefs Fundraiser' })).not.toBeInTheDocument());
  });

  it('keeps a board visible when deletion affects no records', async () => {
    mocks.deleteResult.mockResolvedValue({ data: [], error: null });
    useContests(rows);
    renderDashboard();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Chiefs Fundraiser' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion of Chiefs Fundraiser' }));
    expect(await screen.findByText('The board could not be deleted. Reload your boards and try again.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chiefs Fundraiser' })).toBeInTheDocument();
  });

  it.each([
    { published_at: '2026-09-04T12:00:00Z' },
    { shared_at: '2026-09-04T12:00:00Z' },
    { status: 'live' },
  ])('retains protected boards with an explanation: %j', async (state) => {
    useContests([{ ...rows[0], ...state }]);
    renderDashboard();
    await screen.findByRole('link', { name: 'Chiefs Fundraiser' });
    expect(screen.queryByRole('button', { name: 'Delete Chiefs Fundraiser' })).not.toBeInTheDocument();
    expect(screen.getByText('Only private drafts can be deleted. Shared and published boards are kept to preserve their links and records.')).toBeInTheDocument();
  });

  it('offers the empty state with a way to start a board', async () => {
    useContests([]);
    renderDashboard();

    expect(await screen.findByText('No boards yet.')).toBeInTheDocument();
    expect(screen.getByText('Start with a name and an NFL game. Save a private draft, then add sellers, fill squares, and share when you’re ready.')).toBeVisible();
    const links = screen.getAllByRole('link', { name: 'New board' });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/create'));
  });

  it('states the published allowance and plan once billing resolves', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token-1' } } });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ tier: 'gameday', allowance: 5, used: 2 }),
    })));
    useContests(rows);
    renderDashboard();

    expect(await screen.findByText('2 of 5 published · Game Day')).toBeInTheDocument();
  });
});


it('distinguishes a shared selling board from finalized numbers and offers Manage board', async () => {
  useContests([{ ...rows[0], shared_at: '2026-09-04T12:00:00Z' }]);
  renderDashboard();
  expect(await screen.findByText('Selling squares')).toBeInTheDocument();
  expect(screen.queryByText('Published')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Manage Chiefs Fundraiser' })).toHaveAttribute('href', '/boards/board-1');
});


it('does not offer deletion of a shared board whose link and allowance must survive', async () => {
  useContests([{ ...rows[0], shared_at: '2026-09-04T12:00:00Z' }]);
  renderDashboard();
  await screen.findByText('Selling squares');
  expect(screen.queryByRole('button', { name: 'Delete Chiefs Fundraiser' })).not.toBeInTheDocument();
});
