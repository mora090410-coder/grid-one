import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CreateContest from '../pages/CreateContest';

const mocks = vi.hoisted(() => ({
  parseBoardImage: vi.fn(),
  compressImage: vi.fn(async (image: string) => image),
  signOut: vi.fn(),
  signedIn: true,
  authLoading: false,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.signedIn ? { id: 'user-1' } : null,
    session: { access_token: 'access-token' },
    loading: mocks.authLoading,
    signOut: mocks.signOut,
  }),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    from: vi.fn(),
  },
}));

vi.mock('../services/boardImportService', () => ({
  parseBoardImage: mocks.parseBoardImage,
}));

vi.mock('../utils/image', () => ({
  compressImage: mocks.compressImage,
}));

vi.mock('../components/ScheduledGamePicker', () => ({
  default: ({ onChange }: { onChange: (game: any) => void }) => (
    <button
      type="button"
      onClick={() => onChange({
        id: '401000001',
        kickoffAt: '2026-09-10T00:20:00.000Z',
        state: 'pre',
        season: 2026,
        week: 1,
        awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
        homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
      })}
    >
      Select test game
    </button>
  ),
}));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/create']}>
    <Routes>
      <Route path="/create" element={<CreateContest />} />
      <Route path="/login" element={<h1>Sign up</h1>} />
      <Route path="/boards/:boardId" element={<h1>Board workspace</h1>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  mocks.signedIn = true;
  mocks.authLoading = false;
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('CreateContest one-screen creation', () => {
  it('waits for the sign-in check before offering the signed-out save path', () => {
    mocks.signedIn = false;
    mocks.authLoading = true;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Save and continue' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Sign up' })).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('keeps Create board disabled until both the name and the game are set', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Create board' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Week One Board' } });
    expect(screen.getByRole('button', { name: 'Create board' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));
    expect(screen.getByRole('button', { name: 'Create board' })).toBeEnabled();
  });

  it('stays disabled when the name is only whitespace', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));
    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: 'Create board' })).toBeDisabled();
  });

  it('posts the trimmed name, the mapped game, and a blank board, then opens the board', async () => {
    const createFetch = vi.fn(async () => new Response(JSON.stringify({ poolId: 'pool-9' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', createFetch);

    renderPage();

    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: '  Week One Board  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create board' }));

    await waitFor(() => expect(createFetch).toHaveBeenCalledTimes(1));
    const [url, init] = createFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/pools');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-token');

    const body = JSON.parse(String(init.body));
    expect(body.scoreTestMode).toBe(false);
    expect(body.game.title).toBe('Week One Board');
    expect(body.game.gameExternalId).toBe('401000001');
    // ESPN's away team is the board's left axis; home is the top axis.
    expect(body.game.leftAbbr).toBe('DAL');
    expect(body.game.topAbbr).toBe('WAS');
    expect(body.game.kickoffAt).toBe('2026-09-10T00:20:00.000Z');
    expect(body.game.dates).toBe('2026-09-10');
    expect(body.board.squares).toHaveLength(100);
    expect(body.board.squares.every((names: string[]) => names.length === 0)).toBe(true);

    expect(await screen.findByRole('heading', { name: 'Board workspace' })).toBeVisible();
  });

  it('offers Retry when the create call reports an overloaded upstream', async () => {
    const createFetch = vi.fn(async () => new Response(JSON.stringify({ message: 'The model is overloaded. Try again.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', createFetch);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderPage();

    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Week One Board' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create board' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The model is overloaded. Try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(createFetch).toHaveBeenCalledTimes(2));

    consoleError.mockRestore();
  });

  it('holds Create board disabled while a photo scan is in flight, then re-enables it', async () => {
    const createFetch = vi.fn(async () => new Response(JSON.stringify({ poolId: 'pool-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', createFetch);

    let resolveScan!: (board: any) => void;
    mocks.parseBoardImage.mockReturnValue(new Promise((resolve) => {
      resolveScan = resolve;
    }));

    renderPage();

    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Week One Board' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(['paper board'], 'board.png', { type: 'image/png' })],
      },
    });

    const scanningButton = await screen.findByRole('button', { name: 'Scanning photo…' });
    expect(scanningButton).toBeDisabled();
    expect(createFetch).not.toHaveBeenCalled();

    resolveScan({ squares: Array.from({ length: 100 }, () => []) });

    const createButton = await screen.findByRole('button', { name: 'Create board' });
    expect(createButton).toBeEnabled();
    expect(createFetch).not.toHaveBeenCalled();
  });
});

describe('public preview and auth handoff', () => {
  it('shows a personalized numbered preview without creating a board or requiring login', () => {
    mocks.signedIn = false;
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    renderPage();
    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Baseball families' } });
    expect(screen.getByRole('region', { name: 'Board preview' })).toHaveTextContent('Baseball families');
    expect(screen.getByText('100 squares · Numbers drawn later')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('restores title and game after refresh, then sends an anonymous user to signup without posting', async () => {
    mocks.signedIn = false;
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const page = renderPage();
    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Team fundraiser' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));
    page.unmount(); renderPage();
    expect(screen.getByLabelText('Board name')).toHaveValue('Team fundraiser');
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByRole('heading', { name: 'Sign up' })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps the preview on screen when storage prevents a safe auth handoff', () => {
    mocks.signedIn = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    renderPage();
    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Keep this board' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(screen.getByLabelText('Board name')).toHaveValue('Keep this board');
    expect(screen.getByRole('link', { name: 'Sign in in a new tab' })).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('heading', { name: 'Sign up' })).toBeNull();
  });
});

describe('authenticated draft adoption', () => {
  it('keeps the adopted draft on failure and clears it only after one successful submission', async () => {
    mocks.signedIn = false;
    let page = renderPage();
    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Saved preview' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));
    page.unmount();
    mocks.signedIn = true;
    let finish!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetch);
    page = renderPage();
    expect(screen.getByLabelText('Board name')).toHaveValue('Saved preview');
    const create = screen.getByRole('button', { name: 'Create board' });
    fireEvent.click(create); fireEvent.click(create);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('gridone_create_preview_v1')).not.toBeNull();
    finish(new Response(JSON.stringify({ poolId: 'created-once' }), { status: 200 }));
    expect(await screen.findByRole('heading', { name: 'Board workspace' })).toBeVisible();
    expect(sessionStorage.getItem('gridone_create_preview_v1')).toBeNull();
  });
  it('starts a repeat template without the prior game or any names', () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/create', state: { boardTemplate: { title: 'Again', gameExternalId: 'old', squares: [['Bill']] } } }]}><CreateContest /></MemoryRouter>);
    expect(screen.getByLabelText('Board name')).toHaveValue('Again');
    expect(screen.getByRole('button', { name: 'Create board' })).toBeDisabled();
    const draft = JSON.parse(sessionStorage.getItem('gridone_create_preview_v1')!);
    expect(draft.game.gameExternalId).toBeUndefined();
    expect(draft.board.squares.flat()).toEqual([]);
  });
});
