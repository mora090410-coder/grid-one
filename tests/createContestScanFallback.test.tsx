import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreateContest from '../pages/CreateContest';

const mocks = vi.hoisted(() => ({
  parseBoardImage: vi.fn(),
  compressImage: vi.fn(async (image: string) => image),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    session: { access_token: 'access-token' },
    loading: false,
  }),
}));

vi.mock('../services/geminiService', () => ({
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('CreateContest paper recovery fallback', () => {
  it('keeps blank-board creation usable after an optional scan fails', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.parseBoardImage.mockRejectedValue(new Error('The grid could not be read reliably.'));
    const createFetch = vi.fn(async (..._args: any[]) => new Response(JSON.stringify({
      poolId: 'pool-1',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', createFetch);

    render(
      <MemoryRouter initialEntries={['/create']}>
        <CreateContest />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Board name'), {
      target: { value: 'Week One Board' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(['paper board'], 'board.png', { type: 'image/png' })],
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Image processed, but grid scan failed: The grid could not be read reliably.',
    );
    const blankBoardButton = screen.getByRole('button', { name: 'Create blank 10×10 board' });
    expect(blankBoardButton).toBeEnabled();

    fireEvent.click(blankBoardButton);
    expect(await screen.findByRole('heading', { name: 'Your board is ready to fill.' })).toBeVisible();

    expect(createFetch).toHaveBeenCalledTimes(1);
    const request = createFetch.mock.calls[0];
    expect(request[0]).toBe('/api/pools');
    const body = JSON.parse(String(request[1].body));
    expect(body.game.gameExternalId).toBe('401000001');
    expect(body.board.squares).toHaveLength(100);
    expect(body.board.squares.every((names: string[]) => names.length === 0)).toBe(true);
    await waitFor(() => expect(mocks.parseBoardImage).toHaveBeenCalledTimes(1));
    consoleWarn.mockRestore();
  });
});
