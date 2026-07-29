import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { fetchLiveScore } from '../services/scoreService';
import type { GameState, LiveGameData } from '../types';

vi.mock('../services/scoreService', () => ({
  fetchLiveScore: vi.fn(),
}));

const manualSnapshot: LiveGameData = {
  leftScore: 17,
  topScore: 14,
  quarterScores: {
    Q1: { left: 7, top: 0 },
    Q2: { left: 3, top: 7 },
    Q3: { left: 0, top: 0 },
    Q4: { left: 7, top: 7 },
    OT: { left: 0, top: 0 },
  },
  clock: '',
  period: 4,
  state: 'post',
  detail: 'Organizer-entered score',
  isOvertime: false,
  isManual: true,
  sourceName: 'Organizer',
  retrievedAt: '2026-09-13T20:00:00.000Z',
  staleAfter: '2027-09-13T20:00:00.000Z',
  freshness: 'fresh',
};

const legacyGame: GameState = {
  title: 'Legacy board',
  meta: '',
  leftAbbr: 'DAL',
  leftName: 'Dallas Cowboys',
  topAbbr: 'WAS',
  topName: 'Washington Commanders',
  dates: '2025-09-28',
  lockTitle: false,
  lockMeta: false,
  scoreSnapshot: manualSnapshot,
};

describe('legacy manual live scoring', () => {
  it('keeps a persisted legacy manual snapshot visible without requesting ESPN', async () => {
    const winnerHistory: [] = [];
    const { result, unmount } = renderHook(() =>
      useLiveScoring(legacyGame, true, false, 'ABCDEFGH', winnerHistory));

    await waitFor(() => expect(result.current.liveStatus).toBe('FINAL'));
    expect(result.current.liveData).toEqual(manualSnapshot);
    expect(result.current.isSynced).toBe(true);
    unmount();
  });

  it('refreshes the canonical provider after a final manual override is disabled', async () => {
    const providerSnapshot: LiveGameData = {
      ...manualSnapshot,
      isManual: false,
      sourceName: 'ESPN',
      sourceUrl: 'https://www.espn.com/nfl/game/_/gameId/401772988',
      detail: 'Final',
    };
    vi.mocked(fetchLiveScore).mockResolvedValueOnce({
      score: providerSnapshot,
      winnerHistory: [],
    });

    const manualGame: GameState = {
      ...legacyGame,
      gameExternalId: '401772988',
      useManualScores: true,
    };
    const winnerHistory: [] = [];
    const { result, rerender, unmount } = renderHook(
      ({ game }) => useLiveScoring(game, true, false, 'board-id', winnerHistory),
      { initialProps: { game: manualGame } },
    );

    await waitFor(() => expect(result.current.liveData?.isManual).toBe(true));

    rerender({
      game: {
        ...manualGame,
        useManualScores: false,
        // The server preserves the manual score as the last valid fallback until
        // ESPN replaces it, so Auto must refresh even though this snapshot is Final.
        scoreSnapshot: manualSnapshot,
      },
    });

    await waitFor(() => expect(fetchLiveScore).toHaveBeenCalledWith('board-id'));
    await waitFor(() => expect(result.current.liveData).toEqual(providerSnapshot));
    expect(result.current.liveStatus).toBe('FINAL');
    unmount();
  });
});
