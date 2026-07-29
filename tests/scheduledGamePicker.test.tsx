import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScheduledGamePicker } from '../components/ScheduledGamePicker';
import type { ScheduledGame } from '../types';

const game: ScheduledGame = {
    id: '401000003',
    kickoffAt: '2026-09-10T00:20:00.000Z',
    state: 'pre',
    season: 2026,
    week: 1,
    awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
    homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ScheduledGamePicker', () => {
    it('loads grouped games and returns the complete selected event', async () => {
        const onChange = vi.fn();
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ games: [game] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        render(<ScheduledGamePicker value={null} onChange={onChange} />);

        const option = await screen.findByRole('radio', { name: /DAL.*at.*WAS/i });
        expect(screen.getByText(/Week 1/)).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/nfl/games?scope=upcoming',
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );

        fireEvent.click(option);
        expect(onChange).toHaveBeenCalledWith(game);
    });

    it('requests only five completed games in score-test mode', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ games: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        render(
            <ScheduledGamePicker
                value={null}
                onChange={() => undefined}
                scope="completed"
                limit={5}
            />,
        );

        expect(await screen.findByText('No completed games found')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/nfl/games?scope=completed&limit=5',
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it('shows an actionable provider error and retries', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Feed offline' }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ games: [game] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));
        vi.stubGlobal('fetch', fetchMock);

        render(<ScheduledGamePicker value={null} onChange={() => undefined} />);
        expect(await screen.findByText('Feed offline')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        expect(await screen.findByRole('radio', { name: /DAL.*at.*WAS/i })).toBeInTheDocument();
    });
});
